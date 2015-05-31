var origBlazeRender = Blaze.render;
Blaze.render = function (content, parentElement, nextNode, parentView) {
  // console.log('Blaze.render1', parentElement, nextNode, parentView, content);
  if (parentElement instanceof Node) {
    if (parentElement.vdomId)
      parentElement = Blaze._vdomMapLocal[parentElement.vdomId];
    else {
      // would need to do this differently if nextNode given
      parentElement = realToVirt(parentElement);
    }
  }
  if (nextNode instanceof Node && nextNode.vdomId)
    nextNode = Blaze._vdomMapLocal[nextNode.vdomId];

  // console.log('Blaze.render2', parentElement, nextNode, parentView, content);
  origBlazeRender.call(this, content, parentElement, nextNode, parentView);
};