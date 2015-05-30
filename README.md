# Blaze Virtual DOM Proof-of-Concept

**The Problem**

1. Running synchronous code for longer than the duration of an animation frame causes
   jagged animation.

1. Even without animations, long running synchronous code can "freeze" the browser.
   Even for a "short" freeze, this detracts from UX.

1. Both problems are more pronounced on mobile devices with slower CPUs.

1. Tracker can be modified to break/resume if it runs for too long, but this doesn't
   help if a single reactive function breaks the limit all on it's own, e.g. a
   materialize method.

**Possible Solution**

One goal was to see how few changes could be made to Blaze for this to work.
The solution demonstrated here just adds a single extra file to Blaze
(virtual-dom.js), and one mod to templating (to override `document` there too).
Obviously with deeper work into Blaze we could get even better results.

1. Render to a Virtual DOM
1. Log all DOM operatorions to a queue
1. Optionally run the above (and other parts of Meteor) in a web worker, and
   the below in the main thread (with access to the real DOM).
1. A renderer can process the queue (using a map from vdom<->dom),
   and with a max time limit for a single run.

**Possible Improvements**

1. Optimization.  We just go through the queue, even if some entries have become
   superfluous.  A lot of work though.  We could also try consider minimal
   changes necessary like react does.
1. Event management here is just a hack, could be done properly with a clearer
   separation in Blaze of what *has to* run in main thread.
1. Potentially a lot of Meteor could be made to optionally run in a web worker
   (as a long term project :))
   