/**
 * Copyright © 2014 Jordan Lee, Dave Perrett, Malcolm Jarvis, Bruno Bierbaumer and Sebastian Götte
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function Transmission(remote, prefs)
{
	this.loaddaemonprefs = function(async) {
		this.remote.loaddaemonprefs(function(data) {
			var o = data['arguments'];
			prefs.getclutchprefs(o);
			this.updateguifromsession(o);
			$.merge(this.sessionproperties, o);
		}, this, async);
	};

	this.getAllTorrents = function() {
		return $.map(torrents.slice(0), function(t) {return t});
	};

	this.getTorrentIds = function(torrents) {
		return $.map(torrents.slice(0), function(t) {return t.getid();});
	};

	this.setSortMethod = function(sort_method) {
		this.prefsThing.set("sort-method", sort_method);
		this.refilter(true);
	};

	this.setSortDirection = function(direction) {
		this.prefsThing.set("sort-method", direction);
		this.refilter(true);
	};

	this.setUploadSpeed = function(speed){
		if(speed)
			this.prefsThing.setAll({'speed-limit-up': speed, 'speed-limit-up-enabled': true});
		else
			this.prefsThing.set('speed-limit-up-enabled', false);
	};

	this.setDownloadSpeed = function(speed){
		if(speed)
			this.prefsThing.setAll({'speed-limit-down': speed, 'speed-limit-down-enabled': true});
		else
			this.prefsThing.set('speed-limit-down-enabled', false);
	};

	this.setNotificationsEnabled = function(yes){
		Notifications && Notifications.setEnabled(yes);
	};

	this.updateTorrents = function(ids, fields) {
		callback = function(changed, removed) {
			var needinfo = [];
			var queue = [];

			$.each(changed, $.proxy(function(i, o){
				var tor = this.torrents[o.id];
				if (tor) {
					needed = tor.needsMetaData();
					tor.refresh(o);
					if (needed && !tor.needsMetaData())
						needinfo.push(o.id); /* Metadata was not yet completely fetched from DHT */
				} else {
					tor = new Torrent(o);
					var torrentChanged = $.proxy(function(tor){
						queue.push(tor);
					}, this);
					torrentChanged(tor);
					tor.dataChanged.add(torrentChanged);
					// do we need more info for this torrent?
					if(!('name' in tor.fields && 'status' in tor.fields))
						needinfo.push(o.id);
					tor.downloadComplete.add($.proxy(this.downloadComplete.fire, this.downloadComplete));
					this.torrents[o.id] = tor;
				}
			}, this));

			if (needinfo.length > 0) {
				// whee, new torrents! get their initial information.
				this.updateTorrents(needinfo, Torrent.Fields.Metadata);
			}

			if (removed) {
				$.each(removed, $.proxy(function(i, id){
					var tor = tr.torrents[id];
					tor.deleted = true;
					queue.push(tor);
					delete tr.torrents[id];
				}, this));
			}

			if (queue.length > 0){
				this.torrentsChanged.fire(queue);
			}
		};
		if(fields == null)
			fields = Torrent.Fields.Stats
		this.remote.updateTorrents(ids, fields, $.proxy(callback, this));
	};

	this.refreshTorrents = function() {
		this.updateTorrents('recently-active', Torrent.Fields.Stats);
		clearTimeout(this.refreshTorrentsTimeout);
		//FIXME add refresh-interval session pref
		this.refreshTorrentsTimeout = setTimeout($.proxy(this.refreshTorrents, this), this.sessionproperties["refresh-interval"]);
	};

	this.initializeTorrents = function(ids) {
		this.updateTorrents(ids, Torrent.Fields.Metadata.concat(Torrent.Fields.Stats));
		this.refreshTorrents();
	};

	this.removeTorrents = function(torrents) {
		this.remote.removeTorrents(torrents);
	};

	this.removeTorrentsAndData = function(torrents) {
		this.remote.removeTorrentsAndData(torrents);
	};

	this.renameTorrent = function (torrent, newname) {
		this.remote.renameTorrent([torrent.getId()], torrent.getName(), newname, function(result, obj){
			if(result == 'success')
				torrent.refresh(obj);
		});
	};

	this.startAllTorrents = function() {
		this.startTorrents(this.torrents);
	};

	this.startSelectedTorrents = function() {
		this.startTorrents(this.getSelectedTorrents());
	};

	this.startTorrent = function(torrent) {
		this.startTorrents([ torrent ]);
	};

	this.startTorrents = function(torrents, force) {
		this.remote.startTorrents(this.getTorrentIds(torrents), force);
	};
	this.verifyTorrent = function(torrent) {
		this.verifyTorrents([ torrent ]);
	};
	this.verifyTorrents = function(torrents) {
		this.remote.verifyTorrents(this.getTorrentIds(torrents));
	};

	this.reannounceTorrents = function(torrents) {
		this.remote.reannounceTorrents(this.getTorrentIds(torrents));
	};

	this.stopAllTorrents = function() {
		this.stopTorrents(this.getAllTorrents());
	};

	this.stopSelectedTorrents = function() {
		this.stopTorrents(this.getSelectedTorrents());
	};

	this.stopTorrents = function(torrents) {
		this.remote.stopTorrents(this.getTorrentIds(torrents), $.proxy(this.refreshTorrents, this));
	};

	// Queue
	this.moveTop = function() {
		this.remote.moveTorrentsToTop(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	};
	this.moveUp = function() {
		this.remote.moveTorrentsUp(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	};
	this.moveDown = function() {
		this.remote.moveTorrentsDown(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	};
	this.moveBottom = function() {
		this.remote.moveTorrentsToBottom(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	};

	this.remote = remote
	this.torrents		= {};
	this._rows			= [];
	this.prefs			= prefs.dict;
	this.prefsThing		= prefs;
	this.sessionproperties = {"refresh-interval": 5000};

	this.downloadComplete = $.Callbacks();
	this.torrentsChanged = $.Callbacks();

	this.initializeTorrents(null);
	this.sessionInterval = setInterval($.proxy(this.loadDaemonPrefs,this), 8000);
};
