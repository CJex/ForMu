




// @private
function Type(name,methods) {
  this.name = name;
  Object.assign(this,methods);
}

Type.prototype = {
  /**
  @abstract
  @return Stream<Type>
  */
  examples:undefined,
  /**
  @param {String}
  @return {Type}
  */
  parse:function (v) {return v},
  /**
  Check Error
  @abstract
  @return Option<Error>
  */
  check: function (value) {
    return this.error();
  },
  assert: function (value) {
    var result = this.check(value);
    if (result) {
      throw result;
    }
  },
  error:function (path,relatedError) {
    var msg = "Expect "+ this.toString();
    if (relatedError) {
      msg +=  "\n" + path + " " + relatedError.toString();
    }
    var error = new Error(msg);
    error.related = relatedError;
    error.path = path;
    return error;
  },
  toString:function () {
    return this.name;
  },
  typeId:function () {
    return this.toString();
  }
};


var Any = new Type('Any',{check:noop});


// Primitive Type
// @private
function PrimType(name,primType) {
  this.name = name;
  this.check = function (value) {
    var t = typeof value;
    if (t!==primType) {
      return this.error();
    }
  }
}

PrimType.prototype = Object.create(Type.prototype);

var Str = new PrimType('Str','string');
var Num = new PrimType('Num','number');
Num.parse = function (v) { return +v };
var Bool = new PrimType('Bool','boolean');
Bool.parse = function (v) {return v==='true'};

var Int32 = new Type('Int32',{
  check:function (value) {
    if (value !== (value|0)) {
      return this.error();
    }
  },
  parse:Num.parse
});




// Generic Type constructor, only enhanced with cache
// @private
function construct(name,Class,methods) {
  function G() {
    var T = Object.create(Class.prototype);
    Class.apply(T,arguments);
    var typeId = T.typeId();
    if (G._cache[typeId]) return G._cache[typeId];
    G._cache[typeId] = T;
    return T;
  }
  G._cache = Object.create(null);

  Class.prototype = G.prototype = new Type(name,methods);

  return G;
}

// List(T)
var List = construct('List',function List(T) {
  this.itemType = T;
},{
  check:function (value) {
    if (!(value instanceof Array)) {
      return this.error(value);
    }
    var T = this._itemType;
    for (var i=0;i<value.length;i++) {
      var error = T.check(value[i]);
      if (error) {
        return this.error(i,error);
      }
    }

  },
  toString:function () {
    return this.name + '<' + this.itemType.toString() + '>';
  }
});

// Struct({name:Type})
var Struct = construct('Struct',function Struct(fields) {
  this.fields = keyValuePairs(fields);
},{
  check:function (value) {
    if (!value) {
      return this.error();
    }
    var fields = this.fields;
    for (var i=0;i<fields.length;i++) {
      var field = fields[i];
      var name = field[0], type = field[1];
      var v = value[name];
      var error = type.check(v);
      if (error) {
        return this.error(name,error);
      }
    }
  },
  toString:function () {
    return this.name + '{' + this.fields.map(repr).join(",\n") + '}';
    function repr(a) {
      var name = a[0], type = a[1];
      return name+":"+type.toString().replace("\n","\n  ");
    }
  }
});

// Option(T)
var Option = construct('Option',function Option(T) {
  this.itemType = T;
},{
  check:function (value) {
    if (value != null ) {
      var error = this.itemType.check(value);
      if (error) {
        return this.error(null,error);
      }
    }
  },
  toString:function () {
    return 'Option<'+this.itemType.toString()+'>';
  }
});


// Option(T)
var Enum = construct('Enum',function Enum() {
  this.enumValues = [].slice.call(arguments);
},{
  check:function (value) {
    if (!~this.enumValues.indexOf(value)) {
      return this.error();
    }
  },
  toString:function () {
    return 'Enum<'+this.enumValues.join('|')+'>';
  }
});



var Union = construct('Union',function Union() {
  this.unionTypes = [].slice.call(arguments);
},{
  check:function (value) {
    var types = this.unionTypes;
    for (var i=0;i<types.length;i++) {
      var T = types[i];
      if (!T.check(value)) return;
    }
    return this.error();
  },
  toString:function () {
    return 'Union<'+this.unionTypes.join('|')+'>';
  }
});

var Int32Range = construct('Int32Range',function Int32Range(start,end) {
  this.start = start; this.end = end;
},{
  check:function (value) {
    var error = Int32.check(value);
    if (error) return error;
    if (value < this.start || this.end < value ) {
      return this.error();
    }
  },
  toString:function () {
    return this.name+'<'+this.start+','+this.end+'>'
  },
  parse:Num.parse
});

var RangeText = construct('RangeText',function RangeText(minLength,maxLength) {
  this.minLength = minLength; this.maxLength = maxLength;
},{
  check:function (value) {
    var error = Str.check(value);
    if (error) return error;
    var l = value.length;
    if (l < this.minLength || this.maxLength < l ) {
      return this.error();
    }
  },
  toString:function () {
    return this.name+'<'+this.minLength+','+this.maxLength+'>'
  }
});

var PatternStr = construct('PatternStr',function PatternStr(pattern) {
  this.pattern = pattern;
},{
  check:function (value) {
    var error = Str.check(value);
    if (error) return error;
    if (!this.pattern.test(value)) return this.error();
  },
  toString:function () {
    return this.name+'<'+this.pattern+'>';
  }
});


function Model(name,fields) {
  return alias(Struct(fields),name);
}


function alias(type,name) {
  var T;
  if (typeof type === 'function') {
    T = function () {
      return type.apply(this,arguments);
    };
    T.prototype = Object.create(type.prototype);
    T.prototype.name = name;
    T.prototype.toString = function () {
      return name;
    };
  } else {
    T = Object.create(type);
    T.name = name;
    T.toString = function () {
      return name;
    };
  }
  return T;
}


function keyValuePairs(obj) {
  return Object.keys(obj).map(function (k) {
    return [k,obj[k]];
  });
}

function noop() {}

function objectId(obj) {
  if (!obj._id_) {
    obj._id_ = (+new Date).toString(36) + (Math.random()*1E16|0).toString(36);
  }
  return obj._id_;
}

