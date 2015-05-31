document = Blaze._vdom = function() {};
var queue = Blaze._queue = [];

// Used for event hack, and for Blaze.render when used by user, not internally.
var vdomMapLocal = Blaze._vdomMapLocal = {};

var vNode = function() {
  this.nodeType = vNode.ELEMENT_NODE;
  this.children = [];
  this.childNodes = [];
  this.ownerDocument = document;
  this.attributes = {};  // meant to be a NamedNodeMap

  // Not handled, could be done with getter/setter and/or custom method
  this.style = {};
  this.classList = {
    add: function() {}
  }

  this.vdomId = Random.id();

  // only used for event hack
  vdomMapLocal[this.vdomId] = this;
};

vNode.ELEMENT_NODE = 1;
vNode.ATTRIBUTE_NODE = 2;
vNode.TEXT_NODE = 3;
vNode.CDATA_SECTION_NODE = 4;
vNode.ENTITY_REFERENCE_NODE = 5;
vNode.ENTITY_NODE = 6;
vNode.PROCESSING_INSTRUCTION_NODE = 7;
vNode.COMMENT_NODE = 8;
vNode.DOCUMENT_NODE = 9;
vNode.DOCUMENT_TYPE_NODE = 10;
vNode.DOCUMENT_FRAGMENT_NODE = 11;
vNode.NOTATION_NODE = 12;

// https://developer.mozilla.org/en-US/docs/Web/API/Node/appendChild
vNode.prototype.appendChild = function(child) {
  if (child instanceof Node) {
    console.warn('appendChild on ', this.tagName, this.vdomId, ' given real (non-virtual) node: ', child);
    // child = realToVirt(child);
    // console.log(child);
  }

  child.parentNode = child.parentElement = this;

  if (this.childNodes.length)
    this.childNodes[this.childNodes.length-1].nextSibling = child;
  else
    this.firstChild = child;
  this.lastChild = child;

  this.childNodes.push(child);
 
  if (child.nodeType === vNode.ELEMENT_NODE)
    this.children.push(child);

//  console.log('appendChild', this.vdomId, child.vdomId, this, child);
  queue.push(['appendChild', this.vdomId, child.vdomId]);
  return child;
}

https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore
vNode.prototype.insertBefore = function(newElement, referenceElement) {
  if (!referenceElement)
    return this.appendChild(newElement);

  var index;
  newElement.nextSibling = referenceElement;

  index = this.childNodes.indexOf(referenceElement);
  if (index === 0)
    this.firstChild = newElement;
  if (index > 1)
    this.childNodes[index-1].nextSibling = newElement;
  this.childNodes.splice(index, 0, newElement);

  if (newElement.nodeType === vNode.ELEMENT_NODE)
    this.children.splice(this.children.indexOf(referenceElement), 0, newElement);

  newElement.parentNode = newElement.parentElement = this;

  queue.push(['insertBefore', this.vdomId, newElement.vdomId, referenceElement.vdomId]);
  return newElement;
}

// https://developer.mozilla.org/en-US/docs/Web/API/Node/removeChild
vNode.prototype.removeChild = function(child) {
  var index = this.childNodes.indexOf(child);
  if (index === 0)
    this.firstChild = this.childNodes[1];
  if (index === this.childNodes.length - 1)
    this.lastChild = this.childNodes[this.childNodes.length - 2];
  if (index > 0)
    this.childNodes[index-1].nextSibling = this.childNodes[index+1];
  this.childNodes.splice(index, 1);

  delete vdomMapLocal[child.vdomId];
  queue.push(['removeChild', this.vdomId, child.vdomId]);
}

https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
vNode.prototype.setAttribute = function(name, value) {
  this.attributes[name] = value;
  queue.push(['setAttribute', this.vdomId, name, value]);
}

vNode.prototype.getAttribute = function(name) {
  return this.attributes[name];
}

var vText = function() {
  vNode.call(this);
  this.nodeType = 3;
};

vText.prototype = Object.create(vNode.prototype);
vText.prototype.constructor = vText;

// https://developer.mozilla.org/en-US/docs/Web/API/Document/createTextNode
document.createTextNode = function(data) {
  var node = new vText();
  node.textContent = data;
  queue.push(['createTextNode', data, node.vdomId]);
  return node;
}

// https://developer.mozilla.org/en-US/docs/Web/API/Document/createElement
document.createElement = function(tagName) {
  var node = new vNode();
  node.tagName = tagName.toUpperCase();
  queue.push(['createElement', node.tagName, node.vdomId]);
  return node;
}

document.createDocumentFragment = function() {
  var node = new vNode();
  node.nodeType = vNode.DOCUMENT_FRAGMENT_NODE;
  return node;
}

document.documentElement = document.createElement('HTML');
document.body = document.createElement('BODY');
document.documentElement.appendChild(document.body);

jQuery = function(node) {
  return {
    on: function(/* arguments */) {
      // Note, we'd have to implement a similar map in the other direction to keep
      // callbacks in the main frame if Blaze were to be run within a worker.
      queue.push(['jQuery.on', node.vdomId, Array.prototype.slice.call(arguments)]);
    }
  };
}

jQuery.event = { special: {} };

// obviously a quick hack for the POC, we should use our own lexer/parser
// or even better, htmljs -> vdom
jQuery.parseHTML = function(data) {
  var div = window.document.createElement('div');
  div.innerHTML = data;
  return realToVirt(div).childNodes;
}

// need a real parser to put this in a web worker
realToVirt = function(el) {
  var node;
  if (el.nodeType === Node.TEXT_NODE)
    node = document.createTextNode(el.textContent);
  else if (el.nodeType === Node.ELEMENT_NODE)
    node = document.createElement(el.tagName);
  else
    throw new Error("Unkown node type " + el.nodeType, el);
//  el.vdomId = node.vdomId;

  _.each(el.attributes, function(attr) {
    node.setAttribute(attr.nodeName, attr.nodeValue);
  });

  _.each(el.childNodes, function(child) {
    node.appendChild(realToVirt(child));
  });
  return node;
}

/*
 * --------------------------------- renderer code ---------------------------------
 *
 * If we can avoid passing any functions between this imaginary line, we could
 * in theory have all the above (and large parts of Meteor) running in a web worker,
 * with just the "Renderer" code below running in the main thread
 */

var vdomMap = Blaze._vdomMap = {};
var doc = window.document;

Blaze._processQueue = function(maxTime) {
  var start, runTime, op, el, queueLen = queue.length;

  if (!queueLen)
    return;

  start = performance.now()

  while (op = queue.shift()) {
    //console.log(op);
    switch(op[0]) {

      case 'createTextNode':
        var node = doc.createTextNode(op[1]);
        node.vdomId = op[2];
        vdomMap[op[2]] = node;
        break;

      case 'createElement':
        var node;
        if (op[1] === 'BODY')
          node = doc.body;
        else
          node = doc.createElement(op[1]);
        node.vdomId = op[2];
        vdomMap[op[2]] = node;
        break;

      case 'removeChild':
      case 'appendChild':
        vdomMap[op[1]][op[0]](vdomMap[op[2]]);
        //delete vdomMap[op[1]];
        break;

      case 'insertBefore':
        vdomMap[op[1]].insertBefore(vdomMap[op[2]], vdomMap[op[3]]);
        break;

      case 'setAttribute':
        vdomMap[op[1]].setAttribute(op[2], op[3]);
        break;

      case 'jQuery.on':
        /*
         * Obviously this isn't really part of the POC, we can obviously handle this a
         * lot better if we really wanted to separate the main frame and worker layers,
         * within other files of Blaze.
         */
        el = window.jQuery(vdomMap[op[1]]);
        var orig = op[2][op[2].length-1];
        op[2][op[2].length-1] = (function(orig) {
          return function(evt) {
            // this.$blaze_range = vdomMapLocal[this.vdomId].$blaze_range;
            _.each(['currentTarget', 'delegateTarget', 'fromElement', 'relatedTarget', 'target', 'toElement'], function(prop) {
              if (evt[prop]) {
                evt[prop] = vdomMapLocal[evt[prop].vdomId];
              }
            });
            orig.apply(this, arguments);
          };
        })(orig);
        el.on.apply(el, op[2]);
        break;

      default:
        console.warn('Unknown', op);
    }

    runTime = performance.now() - start;
    if (runTime > maxTime)
      break;
  } /* while */

  console.debug('Processed ' + (queueLen - queue.length) + '/' + queueLen +
    ' DOM method calls in ' + runTime.toFixed(2) + 'ms');
}

// Could depend on time left in current frame if managed by a kernel
var MAX_RUNTIME = 1000 / 60 * 0.8;

var run = function() {
  Blaze._processQueue(MAX_RUNTIME);
  window.requestAnimationFrame(run);
};

Meteor.startup(run);