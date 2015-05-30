if (Meteor.isClient) {
  Items = new Mongo.Collection(null);
  Items.insert({name: 'Apple'});
  Items.insert({name: 'Ball'});
  Items.insert({name: 'Cat'});

  // counter starts at 0
  Session.setDefault('counter', 0);

  Template.hello.helpers({
    counter: function () {
      return Session.get('counter');
    },
    items: function() {
      return Items.find({}, { sort: { name: 1 }} );
    }
  });

  Template.hello.events({
    'click #counterBtn': function () {
      // increment the counter when button is clicked
      Session.set('counter', Session.get('counter') + 1);
    },
    'click #addItemBtn': function (event, tpl) {
      // tpl.find() etc not accomodated yet in the event hack, but again, the POC is
      // to demonstrate rendering
      var value = $('input').val();
      Items.insert({ name: value });
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
