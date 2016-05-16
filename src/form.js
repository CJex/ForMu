
function Form() {

}


Form.for = function (model) {
  var fields = model.fields.map(function (field) {
    var name = field[0], type = field[1];
    return InputElement.for(name,type);
  });

  var form = '<form>'+fields.join('')+'<p><input type="submit" /></p></form>';
  form = html2ele(form);
  form.onsubmit = function (event) {
    event.preventDefault();
    var inputs = [].slice.call(form.querySelectorAll('.invalid'));
    inputs.forEach(function (input) {
      input.classList.remove("invalid");
    });

    var error = model.check(getFormValues());
    if (error) {
      var input = form.querySelector('[name="'+error.path+'"]');
      input.classList.add("invalid");
      alert(error.message);
    }
    return false;
  };
  return form;

  function getFormValues() {
    var a = {};
    model.fields.forEach(function (field) {
      var name = field[0],type = field[1];
      var input = form.querySelector('[name="'+ name +'"]');
      a[name] = type.parse(input.value);
    });
    return a;
  }
};

function InputElement() {}

InputElement.for = function (name,type) {
  var ele;
  if (type instanceof PatternStr) {
    ele = '<input name="'+name+'" />';
  } else if (type instanceof Int32Range) {
    ele = '<input name="'+name+'" maxlength="' + Math.ceil(Math.log(type.end)/Math.LN10)+ '" />';
  } else if (type instanceof RangeText) {
    if (type.maxLength < 100) {
      ele = '<input name="'+name+'" maxlength="'+type.maxLength+'" />';
    } else {
      ele = '<textarea name="'+name+'"  maxlength="'+type.maxLength+'" ></textarea>'
    }
  } else if (type instanceof Enum) {
    ele = '<select name="'+name+'">' + type.enumValues.map(function (v) {
      return '<option value="'+v+'">' + v + '</option>';
    }) + '</select>';
  }

  ele = '<p><label for="'+name+'">'+capitalize(name)+': '+ele+'</label></p>';
  return ele;
};

function capitalize(s) {
  return s.replace(/^(\w)/,function (c) {
    return c.toUpperCase();
  });
}

var _div = document.createElement('div');
function html2ele(html) {
    _div.innerHTML = html.trim();
    var a = _div.firstChild;
    _div.removeChild(_div.firstChild);
    _div.innerHTML = "";
    return a;
}
