/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function TransmissionPrefs(remote) {
		this.initialize(remote);
}

TransmissionPrefs.prototype = {
	// all the RPC session keys that we have gui controls for
	keys: [
		'alt-speed-down',
		'alt-speed-time-begin',
		'alt-speed-time-day',
		'alt-speed-time-enabled',
		'alt-speed-time-end',
		'alt-speed-up',
		'blocklist-enabled',
		'blocklist-size',
		'blocklist-url',
		'dht-enabled',
		'download-dir',
		'encryption',
		'idle-seeding-limit',
		'idle-seeding-limit-enabled',
		'lpd-enabled',
		'peer-limit-global',
		'peer-limit-per-torrent',
		'peer-port',
		'peer-port-random-on-start',
		'pex-enabled',
		'port-forwarding-enabled',
		'rename-partial-files',
		'seedRatioLimit',
		'seedRatioLimited',
		'speed-limit-down',
		'speed-limit-down-enabled',
		'speed-limit-up',
		'speed-limit-up-enabled',
		'start-added-torrents',
		'utp-enabled'
	],

	// map of keys that are enabled only if a 'parent' key is enabled
	groups: {
		'alt-speed-time-enabled': ['alt-speed-time-begin',
								   'alt-speed-time-day',
								   'alt-speed-time-end' ],
		'blocklist-enabled': ['blocklist-url',
							  'blocklist-update-button' ],
		'idle-seeding-limit-enabled': [ 'idle-seeding-limit' ],
		'seedRatioLimited': [ 'seedRatioLimit' ],
		'speed-limit-down-enabled': [ 'speed-limit-down' ],
		'speed-limit-up-enabled': [ 'speed-limit-up' ]
	}

	initialize: function (remote) {
        this.remote = remote;
		this.populate();
		this.dict = {};
		this.updateCallbacks = $.Callbacks(); /* Fired when the preferences change */
    },

	populate: function() {
		var po = this;
		this.remote.loadDaemonPrefs(function(o){
			$.merge(po.dict, o);
		});
	},

	setPref: function(key, value) {
        data.remote.savePref(o, $.proxy(function(){
			this.dict[key] = value;
			this.updateCallbacks.fire();
		}, this));
    }
};
