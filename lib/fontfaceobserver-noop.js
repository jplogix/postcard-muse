function FontFaceObserver(family, descriptors) {
  this.family = family;
  this.style = (descriptors || {}).style || "normal";
  this.weight = (descriptors || {}).weight || "normal";
  this.stretch = (descriptors || {}).stretch || "normal";
}

FontFaceObserver.prototype.load = function () {
  return Promise.resolve(this);
};

module.exports = FontFaceObserver;
