var hasOwn = Object.prototype.hasOwnProperty
export const _inherits = function (Child, Parent) {
  // copy Parent static properties
  for (var key in Parent) {
    // make sure we only copy hasOwnProperty properties vs. prototype
    // properties
    if (hasOwn.call(Parent, key)) {
      Child[key] = Parent[key]
    }
  }

  // a middle member of prototype chain: takes the prototype from the Parent
  var Middle = function () {
    this.constructor = Child
  }
  Middle.prototype = Parent.prototype
  Child.prototype = new Middle()
  Child.__super__ = Parent.prototype
  return Child
}
