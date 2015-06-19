# Blaze Virtual DOM Proof-of-Concept

**The Problem**

1. Running synchronous code for longer than the duration of an animation
   frame causes jagged animation.

1. Even without animations, long running synchronous code can "freeze" the
   browser.  Even for a "short" freeze, this detracts from UX.

1. Both problems are more pronounced on mobile devices with slower CPUs.

1. Tracker can be modified to break/resume if it runs for too long, but this
   doesn't help if a single reactive function breaks the limit all on it's
   own, e.g. a template materialization function.

**Possible Solution**

One goal was to see how few changes could be made to Blaze for this to work.
The solution demonstrated here just adds a single extra file to the `blaze`
package,
([virtual-dom.js](https://github.com/gadicc/meteor-blaze-virtual-dom/blob/master/packages/blaze/virtual-dom.js)),
and one mod to `templating` (to override `document` there too).
Obviously with deeper work into Blaze we could get even better results.

1. Render to a Virtual DOM
1. Log all DOM operations to a queue ("dom oplog")
1. Optionally run the above (and other parts of Meteor) in a web worker,
   and the below in the main thread (with access to the real DOM).  (Not
   implemented, but possible with this design).
1. A renderer can process the queue (using a map from vdom<->dom),
   and with a max time limit for a single run, e.g. on `requestAnimationFrame`,
   with a max time of less than 16.67ms.

This really is just a proof-of-concept.  Very limited scenarios were tested.  Need to
consider:

* DOM manipulation e.g. by a jQuery plugin -- probably will work
* But, lifecycle callbacks / templateInstances would probably need to map to the real
  DOM. Or keep existing API on real DOM but give access to the virtual DOM too.
* If using web workers, need to consider which thread will run what (app code too).
* Probably a lot of other things :>

**Possible Improvements**

1. Optimization.  We just go through the queue, even if some entries have become
   superfluous.  A lot of work though.  We could also try consider minimal
   changes necessary like react does (rather than the current complete rerender
   of albeit smaller parts).
1. DOM element recycling.  On removeElement, keep a reference to the DOM node,
   kept in a pool, and used as first choice for insertElement.
1. Event management here is just a hack, could be done properly with a clearer
   separation in Blaze of what *has to* run in main thread (not to force anything
   on the user, but to make the option available).
1. Potentially a lot of Meteor could be made to optionally run in a web worker
   (as a long term project :)).

**So does this make Blaze faster?**

No, it makes Blaze slower, but, non-blocking.  This means that even if DOM
updates take longer to complete, they won't block animations frames or the
browser in general, leading to a significantly smoother experience for the
user.

Moving things to a web worker could mean your app as a whole runs faster,
since  multiple threads are utilized.  And with additional opttimizations in
place, yes things could actually become a lot faster.