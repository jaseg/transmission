/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function TransmissionPrefs(remote) {
	// all the RPC session keys that we have gui controls for
	this.keys = [
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
		'utp-enabled',
		'sort-method',
		'sort-direction',
		'filter'
	];

	this.populate = function() {
		var po = this;
		this.remote.loadDaemonPrefs(function(o){
			$.merge(po.dict, o);
		});
	};

	this.get = function(key){
		return this.dict[key];
	};

	this.set = function(key, value) {
		data.remote.savePref(o, $.proxy(function(){
			this.dict[key] = value;
			this.updateCallbacks.fire();
		}, this));
	};

	this.setAll = function(prefs) {
		data.remote.savePref(o, $.proxy(function(){
			$.merge(this.dict, prefs);
			this.updateCallbacks.fire();
		}, this));
	};
	
	this.remote = remote;
	this.dict = {};
	this.updateCallbacks = $.Callbacks(); /* Fired when the preferences change */
	this.populate();
}
