EventManager = function() {
	"use strict";

	var hooks = Meteor.require('hooks'),
		_insert = function(client, message, type, tab, user) {
			var channel = (message.channel && !message.target) ? message.channel : message.target,
				user = user || ChannelUsers.findOne({network: client.name, channel: channel, nickname: message.nickname});
			// get a channel user object if we've not got one

			if (!message.channel && !message.target) {
				var id = client._id;
			} else {
				var id = (!message.channel) ? client.internal.tabs[message.target]._id : client.internal.tabs[message.channel]._id;
			}
			// get the tab id
			
			var prefixObject = Manager.getPrefix(client, user),
				output = {
					type: type,
					user: client.internal.userId,
					tab: id,
					message: message,
					read: false,
					extra: {
						self: (client.nick === message.nickname) ? true : false,
						highlight: false,
						prefix: prefixObject.prefix
					}
				};

			Events.insert(output);
			// get the prefix, construct an output and insert it
		};

	var Manager = {
		init: function() {
			Meteor.publish('events', function() {
				return Events.find({user: this.userId});
			});

			Events.allow({
				update: function (userId, doc, fields, modifier) {	
					return doc.user === userId;
				},
				fetch: ['user']
			});
			// allow our events documents to be changed by us
		},

		insertEvent: function(client, message, type) {
			var self = this;

			if (type == 'nick' || type == 'quit') {
				var chans = ChannelUsers.find({network: client.name, nickname: message.nickname});
				// find the channel, we gotta construct a query (kinda messy)

				chans.forEach(function(chan) {
					message.channel = chan.channel;
					_insert(client, message, type, chan._id, chan);
					// we're in here because the user either changing their nick
					// or quitting, exists in this channel, lets add it to the event
				});

				if (_.has(client.internal.tabs, message.nickname)) {
					_insert(client, message, type, client.internal.tabs[message.nickname], chan);
				}
				// these two types wont have a target, or a channel, so
				// we'll have to do some calculating to determine where we want them
				// we shall put them in channel and privmsg tab events
			} else {
				_insert(client, message, type, client.internal.tabs[message.target] || client._id);
			}
		},

		getPrefix: function(client, user) {
			if (user === undefined || _.isEmpty(user.modes)) {
				return {prefix: '', sort: 6};
			}
			// empty object

			var keys = _.keys(client.internal.capabilities.modes.prefixmodes),
				values = _.values(user.modes),
				sorted = [];

			keys.forEach(function(key) {
				if (_.indexOf(values, key) > -1) {
					sorted.push(key);
				}
			});
			// sort modes in q, a, o, h, v order

			for (var i in sorted) {
				var mode = sorted[i];
				switch (mode) {
					case 'q':
						return {prefix: client.internal.capabilities.modes.prefixmodes[mode], sort: 1};
						break;
					case 'a':
						return {prefix: client.internal.capabilities.modes.prefixmodes[mode], sort: 2};
						break;
					case 'o':
						return {prefix: client.internal.capabilities.modes.prefixmodes[mode], sort: 3};
						break;
					case 'h':
						return {prefix: client.internal.capabilities.modes.prefixmodes[mode], sort: 4};
						break;
					case 'v':
						return {prefix: client.internal.capabilities.modes.prefixmodes[mode], sort: 5};
						break;
				}
			}
			// loop through the modes in a normal for loop so we can return
		}
	};

	Manager.init();

	return _.extend(Manager, hooks);
};