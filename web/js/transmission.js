/**
 * Copyright © 2014 Jordan Lee, Dave Perrett, Malcolm Jarvis, Bruno Bierbaumer and Sebastian Götte
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function Transmission(remote, prefs)
{
	this.initialize(remote, prefs);
}

Transmission.prototype =
{
	initialize: function(remote, prefs) {
		this.remote = remote
		this.torrents		= {};
		this._rows			= [];
		this.changedTorrents= {};
		this.prefs			= prefs.dict;
		this.prefsThing		= prefs;

		this.downloadComplete = $.Callbacks();
		this.statusUpdate = $.Callbacks();

		this.initializeTorrents(null);
		this.sessionInterval = setInterval($.proxy(this.loadDaemonPrefs,this), 8000);
	},

	loaddaemonprefs: function(async) {
		this.remote.loaddaemonprefs(function(data) {
			var o = data['arguments'];
			prefs.getclutchprefs(o);
			this.updateguifromsession(o);
			this.sessionproperties = o;
		}, this, async);
	},

	getAllTorrents: function() {
		return $.map(torrents.slice(0), function(t) {return t});
	},

	getTorrentIds: function(torrents) {
		return $.map(torrents.slice(0), function(t) {return t.getid();});
	},

	setPref: function(key, val) {
		this.prefs[key] = val;
		prefs.setvalue(key, val);
	},

	setSortMethod: function(sort_method) {
		this.setPref(Prefs._SortMethod, sort_method);
		this.refilter(true);
	},

	setSortDirection: function(direction) {
		this.setPref(Prefs._SortDirection, direction);
		this.refilter(true);
	},

	setUploadSpeed: function(speed){
		if(speed)
			remote.savePrefs({'speed-limit-up': speed,
							  'speed-limit-up-enabled': true});
		else
			remote.savePrefs({'speed-limit-up-enabled': false});
	},

	setDownloadSpeed: function(speed){
		if(speed)
			remote.savePrefs({'speed-limit-down': speed,
							  'speed-limit-down-enabled': true});
		else
			remote.savePrefs({'speed-limit-down-enabled': false});
	},

	setNotificationsEnabled: function(yes){
		Notifications && Notifications.setEnabled(yes);
	},

	torrentChanged: function(tor){
		this.changedTorrents[tor.getId()] = tor;
		this.refilterSoon();
	},

	updateTorrents: function(ids, fields) {
		callback = function(changed, removed) {
			var needinfo = [];

			$.each(changed, function(i, o){
				var tor = this.torrents[o.id];
				if (tor) {
					needed = tor.needsMetaData();
					tor.refresh(o);
					if (needed && !tor.needsMetaData())
						needinfo.push(id); /* Metadata was not yet completely fetched from DHT */
				} else {
					tor = new Torrent(o);
					torrentChanged(tor);
					tor.dataChanged.add($.proxy(this.torrentChanged,this));
					// do we need more info for this torrent?
					if(!('name' in tor.fields && 'status' in tor.fields))
						needinfo.push(id);
					tor.downloadComplete.add($.proxy(this.downloadComplete.fire, this.downloadComplete));
					this.torrents[id] = tor;
				}
			});

			if (needinfo.length > 0) {
				// whee, new torrents! get their initial information.
				this.updateTorrents(needinfo, Torrent.Fields.Metadata);
			}

			var tr = this;
			$.each(removed, function(i, id){
				tr.changedTorrents[id] = null;
				delete tr.torrents[id];
			});
			this.refilterSoon();
		};
		this.remote.updateTorrents(ids, Torrent.Fields.Stats, $.proxy(callback, this));
	},

	refreshTorrents: function() {
		this.updateTorrents('recently-active', Torrent.Fields.Stats);
		clearTimeout(this.refreshTorrentsTimeout);
		this.refreshTorrentsTimeout = setTimeout($.proxy(this.refreshTorrents, this), this.prefs[Prefs._RefreshRate] * 1000);
	},

	initializeTorrents: function(ids) {
		this.updateTorrents(ids, Torrent.Fields.Metadata);
		this.refreshTorrents();
	},

	removeTorrents: function(torrents) {
		this.remote.removeTorrents(torrents);
	},

	removeTorrentsAndData: function(torrents) {
		this.remote.removeTorrentsAndData(torrents);
	},

	renameTorrent: function (torrent, newname) {
		this.remote.renameTorrent([torrent.getId()], torrent.getName(), newname, function(result, obj){
			if(result == 'success')
				torrent.refresh(obj);
		});
	},

	startAllTorrents: function() {
		this.startTorrents(this.torrents);
	},

	startSelectedTorrents: function() {
		this.startTorrents(this.getSelectedTorrents());
	},

	startTorrent: function(torrent) {
		this.startTorrents([ torrent ]);
	},

	startTorrents: function(torrents, force) {
		this.remote.startTorrents(this.getTorrentIds(torrents), force);
	},
	verifyTorrent: function(torrent) {
		this.verifyTorrents([ torrent ]);
	},
	verifyTorrents: function(torrents) {
		this.remote.verifyTorrents(this.getTorrentIds(torrents));
	},

	reannounceTorrents: function(torrents) {
		this.remote.reannounceTorrents(this.getTorrentIds(torrents));
	},

	stopAllTorrents: function() {
		this.stopTorrents(this.getAllTorrents());
	},

	stopSelectedTorrents: function() {
		this.stopTorrents(this.getSelectedTorrents());
	},

	stopTorrents: function(torrents) {
		this.remote.stopTorrents(this.getTorrentIds(torrents), $.proxy(this.refreshTorrents, this));
	},

	changeFileCommand: function(torrentId, rowIndices, command) {
		this.remote.changeFileCommand(torrentId, rowIndices, command);
	},

	hideMobileAddressbar: function(delaySecs) {
		if (isMobileDevice && !scroll_timeout) {
			var callback = $.proxy(this.doToolbarHide,this),
			    msec = delaySecs*1000 || 150;
			scroll_timeout = setTimeout(callback,msec);
		}
	},

	// Queue
	moveTop: function() {
		this.remote.moveTorrentsToTop(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	},
	moveUp: function() {
		this.remote.moveTorrentsUp(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	},
	moveDown: function() {
		this.remote.moveTorrentsDown(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	},
	moveBottom: function() {
		this.remote.moveTorrentsToBottom(this.getSelectedTorrentIds(), $.proxy(this.refreshTorrents, this));
	},

	/****
	*****
	*****  FILTER
	*****
	****/

	sortRows: function(rows)
	{
		var i, tor, row,
		    id2row = {},
		    torrents = [];

		for (i=0; row=rows[i]; ++i) {
			tor = row.getTorrent();
			torrents.push(tor);
			id2row[ tor.getId() ] = row;
		}

		Torrent.sortTorrents(torrents, this.prefs[Prefs._SortMethod],
		                               this.prefs[Prefs._SortDirection]);

		for (i=0; tor=torrents[i]; ++i)
			rows[i] = id2row[ tor.getId() ];
	},

	refilter: function(rebuildEverything)
	{
		var sort_mode		= this.prefs[Prefs._SortMethod];
		var sort_direction	= this.prefs[Prefs._SortDirection];
		var filter_mode		= this.prefs[Prefs._FilterMode];
		var list = $('#torrent_list');

		this.updateFilterSelect();

		clearTimeout(this.refilterTimer);
		delete this.refilterTimer;

		var dirtyTorrents = this.dirtyTorrents;
		if (rebuildEverything)
			dirtyTorrents = this.torrents;
		this.dirtyTorrents = {};

		/* Get a list of all displayed rows with changed data */
		changed = list.children('.torrent-entry').filter(function(idx, elem){
			var torrent = dirtyTorrents[elem.torrent.getId()];
			delete dirtyTorrents[elem.torrent.getId()];
			return !!torrent;
		});
		/* Remove elements not matching the filter anymore */
		changed.filter(function(idx, elem){
			if(elem.torrent.test(filter_mode, filter_text))
				return true;
			elem.remove();
			return false
		});

		/* Add all remaining changed torrents that match the filter */
		var template = $('#torrent-entry-template');
		$.each(dirtyTorrents, function(idx, tor){
			if(!tor.test(filter_mode, filter_text))
				return;
			var entry = template.clone();
			entry.children('#title').text();
			var text = tor.getHaveStr();
			if (!tor.isDone())
				text += '/' + tor.getSizeWhenDoneStr();
			entry.children('#size').text(text);
			entry.children('#ratio').text(tor.getUploadRatioStr());
			var progress = entry.children('#progress');
			progress.text(tor.getProgressStr());
			progress.attr('aria-valuenow', tor.getProgress());
			list.append(entry);
		});
		
		/* TODO if this performs too poor, perhaps re-introduce the old behavior of just sorting the changed rows and
		 * then doing a merge */
		list.tsort('', {sortFunction: function(a, b){
			return Torrent.compareTorrents(a.e.torrent, b.e.torrent, this.prefs[Prefs._SortMethod],
				this.prefs[Prefs._SortDirection]);
		}});

		this.statusUpdate.fire(total_up, total_down, rows.length);
		/* TODO selection stuff: if (old_sel_count !== $(list).children('.selected').length)
			this.selectionChanged(); */
	},

	setFilterMode: function(mode) {
		this.setPref(Prefs._FilterMode, mode);
		this.refilter(true);
	}
};
