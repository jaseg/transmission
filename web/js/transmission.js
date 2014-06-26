/**
 * Copyright © 2014 Jordan Lee, Dave Perrett, Malcolm Jarvis, Bruno Bierbaumer and Sebastian Götte
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

function Transmission()
{
	this.initialize();
}

Transmission.prototype =
{
	/****
	*****
	*****  STARTUP
	*****
	****/

	initialize: function()
	{
		var e;

		// Initialize the helper classes
		this.remote = new TransmissionRemote(this);
		this.inspector = new Inspector(this, this.remote);

		// Initialize the implementation fields
		this.torrents		= {};
		this._rows			= [];
		this.changedTorrents= {};
		this.prefs			= {};

		this.downloadComplete = $.Callbacks();

		// Get preferences & torrents from the daemon
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

	/****
	*****
	*****  utilities
	*****
	****/

	getAllTorrents: function()
	{
		return $.map(torrents.slice(0), function(t) {return t});
	},

	getTorrentIds: function(torrents)
	{
		return $.map(torrents.slice(0), function(t) {return t.getid();});
	},

	setPref: function(key, val)
	{
		this.prefs[key] = val;
		prefs.setvalue(key, val);
	},

	/*--------------------------------------------
	 *
	 *  e v e n t   f u n c t i o n s
	 *
	 *--------------------------------------------*/

	pauseresumeselected: function(ev) {
		/* FIXME */
	},

	stopallclicked: function(ev) {
		/* FIXME */
	},

	startallclicked: function(ev) {
		/* FIXME */
	},

	dragenter: function(ev) {
		if (ev.datatransfer && ev.datatransfer.types) {
			var types = ["text/uri-list", "text/plain"];
			for (var i = 0; i < types.length; ++i) {
				// it would be better to look at the links here;
				// sadly, with firefox, trying would throw.
				if (ev.datatransfer.types.contains(types[i])) {
					ev.stoppropagation();
					ev.preventdefault();
					ev.dropeffect = "copy";
					return false;
				}
			}
		}
		else if (ev.datatransfer) {
			ev.datatransfer.dropeffect = "none";
		}
		return true;
	},

	drop: function(ev) {
		if (!ev.datatransfer || !ev.datatransfer.types)
			return true;

		/* Give text/uri-list preference over text/plain. */
		var uris = ev.datatransfer.getData('text/uri-list') || ev.datatransfer.getData('text/plain');

		var tr = this;
		$.each(uris.split("\n"), function(i, uri){
			if (/^#/.test(uri)) // lines which start with "#" are comments
				continue;
			if (/^[a-z-]+:/i.test(uri)) // close enough to a url
				this.remote.addtorrentbyurl(uri, false); /* TODO: the paused setting was configurable */
		}

		ev.preventdefault();
		return false;
	},

	/*--------------------------------------------
	 *
	 *  I N T E R F A C E   F U N C T I O N S
	 *
	 *--------------------------------------------*/

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
			remote.savePrefs({RPC._UpSpeedLimit: speed,
							  RPC._UpSpeedLimited: true});
		else
			remote.savePrefs({RPC._UpSpeedLimited: false});
	},

	setDownloadSpeed: function(speed){
		if(speed)
			remote.savePrefs({RPC._DownSpeedLimit: speed,
							  RPC._DownSpeedLimited: true});
		else
			remote.savePrefs({RPC._DownSpeedLimited: false});
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
			}

			if (needinfo.length > 0) {
				// whee, new torrents! get their initial information.
				this.updateTorrents(needinfo, Torrent.Fields.Metadata);
			}

			var tr = this;
			$.each(removed, function(i, id){
				tr.changedTorrents[id] = null;
				delete tr.torrents[id];
			}
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

	onTorrentRenamed: function(response) {
		var torrent;
		if ((response.result === 'success') &&
		    (response.arguments) &&
		    ((torrent = this.torrents[response.arguments.id])))
		{
			torrent.refresh(response.arguments);
		}
	},

	renameTorrent: function (torrent, newname) {
		var oldpath = torrent.getName();
		this.remote.renameTorrent([torrent.getId()], oldpath, newname, this.onTorrentRenamed, this);
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

	reannounceTorrent: function(torrent) {
		this.reannounceTorrents([ torrent ]);
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
	stopTorrent: function(torrent) {
		this.stopTorrents([ torrent ]);
	},
	stopTorrents: function(torrents) {
		this.remote.stopTorrents(this.getTorrentIds(torrents),
		                         this.refreshTorrents, this);
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
	doToolbarHide: function() {
		window.scrollTo(0,1);
		scroll_timeout=null;
	},

	// Queue
	moveTop: function() {
		this.remote.moveTorrentsToTop(this.getSelectedTorrentIds(),
		                              this.refreshTorrents, this);
	},
	moveUp: function() {
		this.remote.moveTorrentsUp(this.getSelectedTorrentIds(),
		                           this.refreshTorrents, this);
	},
	moveDown: function() {
		this.remote.moveTorrentsDown(this.getSelectedTorrentIds(),
		                             this.refreshTorrents, this);
	},
	moveBottom: function() {
		this.remote.moveTorrentsToBottom(this.getSelectedTorrentIds(),
		                                 this.refreshTorrents, this);
	},

	/***
	****
	***/

	updateGuiFromSession: function(o)
	{
		var limit, limited, e, b, text,
                    fmt = Transmission.fmt,
                    menu = $('#settings_menu');

		this.serverVersion = o.version;

		this.prefsDialog.set(o);

		if ('alt-speed-enabled' in o)
		{
			b = o['alt-speed-enabled'];
			e = $('#turtle-button');
			text = [ 'Click to ', (b?'disable':'enable'),
			         ' Temporary Speed Limits (',
			         fmt.speed(o['alt-speed-up']),
			         ' up,',
			         fmt.speed(o['alt-speed-down']),
			         ' down)' ].join('');
			e.toggleClass('selected', b);
			e.attr('title', text);
		}

		if (this.isMenuEnabled && ('speed-limit-down-enabled' in o)
		                       && ('speed-limit-down' in o))
		{
			limit = o['speed-limit-down'];
			limited = o['speed-limit-down-enabled'];

			e = menu.find('#limited_download_rate');
                        e.html('Limit (' + fmt.speed(limit) + ')');

                        if (!limited)
                        	e = menu.find('#unlimited_download_rate');
                        e.deselectMenuSiblings().selectMenuItem();
		}

		if (this.isMenuEnabled && ('speed-limit-up-enabled' in o)
		                       && ('speed-limit-up' o))
		{
			limit = o['speed-limit-up'];
			limited = o['speed-limit-up-enabled'];

			e = menu.find('#limited_upload_rate');
                        e.html('Limit (' + fmt.speed(limit) + ')');

                        if (!limited)
                        	e = menu.find('#unlimited_upload_rate');
                        e.deselectMenuSiblings().selectMenuItem();
		}
	},

	updateStatus: function()
	{
		var up=0, down=0,
		    fmt = Transmission.fmt;

		// up/down speed
		this.torrents.each(function(i, t){
			u += t.getUploadSpeed();
			d += t.getDownloadSpeed();
		});

		$('#speed-up-label').text(fmt.speedBps(up));
		$('#speed-dn-label').text(fmt.speedBps(down));

		// visible torrents
		$('#count-label').text(fmt.countString('Transfer','Transfers',this.visibleTorrents.length) );
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
		var i, e, id, t, row, tmp, rows, clean_rows, dirty_rows, frag,
		    sort_mode = this.prefs[Prefs._SortMethod],
		    sort_direction = this.prefs[Prefs._SortDirection],
		    filter_mode = this.prefs[Prefs._FilterMode],
		    filter_tracker = this.filterTracker,
		    renderer = this.torrentRenderer,
		    list = this.elements.torrent_list,
		    old_sel_count = $(list).children('.selected').length;

		this.updateFilterSelect();

		clearTimeout(this.refilterTimer);
		delete this.refilterTimer;

		if (rebuildEverything) {
			$(list).empty();
			this._rows = [];
			for (id in this.torrents)
				this.dirtyTorrents[id] = true;
		}

		// rows that overlap with dirtyTorrents need to be refiltered.
		// those that don't are 'clean' and don't need refiltering.
		clean_rows = [];
		dirty_rows = [];
		for (i=0; row=this._rows[i]; ++i) {
			if(row.getTorrentId() in this.dirtyTorrents)
				dirty_rows.push(row);
			else
				clean_rows.push(row);
		}

		// remove the dirty rows from the dom
		e = [];
		for (i=0; row=dirty_rows[i]; ++i)
			e.push (row.getElement());
		$(e).detach();

		// drop any dirty rows that don't pass the filter test
		tmp = [];
		for (i=0; row=dirty_rows[i]; ++i) {
			id = row.getTorrentId();
			t = this.torrents[ id ];
			if (t && t.test(filter_mode, filter_text, filter_tracker))
				tmp.push(row);
			delete this.dirtyTorrents[id];
		}
		dirty_rows = tmp;

		// make new rows for dirty torrents that pass the filter test
		// but don't already have a row
		for (id in this.dirtyTorrents) {
			t = this.torrents[id];
			if (t && t.test(filter_mode, filter_text, filter_tracker)) {
				row = new TorrentRow(renderer, this, t);
				e = row.getElement();
				e.row = row;
				dirty_rows.push(row);
				$(e).click($.proxy(this.onRowClicked,this));
				$(e).dblclick($.proxy(this.toggleInspector,this));
			}
		}

		// sort the dirty rows
		this.sortRows (dirty_rows);

		// now we have two sorted arrays of rows
		// and can do a simple two-way sorted merge.
		rows = [];
		var ci=0, cmax=clean_rows.length;
		var di=0, dmax=dirty_rows.length;
		frag = document.createDocumentFragment();
		while (ci!=cmax || di!=dmax)
		{
			var push_clean;

			if (ci==cmax)
				push_clean = false;
			else if (di==dmax)
				push_clean = true;
			else {
				var c = Torrent.compareTorrents(
				           clean_rows[ci].getTorrent(),
				           dirty_rows[di].getTorrent(),
				           sort_mode, sort_direction);
				push_clean = (c < 0);
			}

			if (push_clean)
				rows.push(clean_rows[ci++]);
			else {
				row = dirty_rows[di++];
				e = row.getElement();
				if (ci !== cmax)
					list.insertBefore(e, clean_rows[ci].getElement());
				else
					frag.appendChild(e);
				rows.push(row);
			}
		}
		list.appendChild(frag);

		// update our implementation fields
		this._rows = rows;
		this.dirtyTorrents = {};

		// jquery's even/odd starts with 1 not 0, so invert its logic
		e = []
		for (i=0; row=rows[i]; ++i)
			e.push(row.getElement());
		$(e).filter(":odd").addClass('even'); 
		$(e).filter(":even").removeClass('even'); 

		// sync gui
		this.updateStatusbar();
		if (old_sel_count !== $(list).children('.selected').length)
			this.selectionChanged();
	},

	setFilterMode: function(mode)
	{
		// set the state
		this.setPref(Prefs._FilterMode, mode);

		// refilter
		this.refilter(true);
	},

	onFilterModeClicked: function(ev)
	{
		this.setFilterMode($('#filter-mode').val());
	},

	onFilterTrackerClicked: function(ev)
	{
		var tracker = $('#filter-tracker').val();
		this.setFilterTracker(tracker==='all' ? null : tracker);
	},

	setFilterTracker: function(domain)
	{
		// update which tracker is selected in the popup
		var key = domain ? this.getReadableDomain(domain) : 'all',
		    id = '#show-tracker-' + key;
		$(id).addClass('selected').siblings().removeClass('selected');

		this.filterTracker = domain;
		this.refilter(true);
	},

	// example: "tracker.ubuntu.com" returns "ubuntu.com"
	getDomainName: function(host)
	{
		var dot = host.indexOf('.');
		if (dot !== host.lastIndexOf('.'))
			host = host.slice(dot+1);
		return host;
	},

	// example: "ubuntu.com" returns "Ubuntu"
	getReadableDomain: function(name)
	{
		if (name.length)
			name = name.charAt(0).toUpperCase() + name.slice(1);
		var dot = name.indexOf('.');
		if (dot !== -1)
			name = name.slice(0, dot);
		return name;
	},

	/***
	****
	****  Statistics
	****
	***/

	// turn the periodic ajax stats refresh on & off
	togglePeriodicStatsRefresh: function(enabled) {
		clearInterval(this.statsInterval);
		delete this.statsInterval;
		if (enabled) {
			var callback = $.proxy(this.loadDaemonStats,this),
                            msec = 5000;
			this.statsInterval = setInterval(callback, msec);
		}
	},

	loadDaemonStats: function(async) {
		this.remote.loadDaemonStats(function(data) {
			this.updateStats(data['arguments']);
		}, this, async);
	},

	// Process new session stats from the server
	updateStats: function(stats)
	{
		var s, ratio,
		    fmt = Transmission.fmt;

		s = stats["current-stats"];
		ratio = Math.ratio(s.uploadedBytes,s.downloadedBytes);
		$('#stats-session-uploaded').html(fmt.size(s.uploadedBytes));
		$('#stats-session-downloaded').html(fmt.size(s.downloadedBytes));
		$('#stats-session-ratio').html(fmt.ratioString(ratio));
		$('#stats-session-duration').html(fmt.timeInterval(s.secondsActive));

		s = stats["cumulative-stats"];
		ratio = Math.ratio(s.uploadedBytes,s.downloadedBytes);
		$('#stats-total-count').html(s.sessionCount + " times");
		$('#stats-total-uploaded').html(fmt.size(s.uploadedBytes));
		$('#stats-total-downloaded').html(fmt.size(s.downloadedBytes));
		$('#stats-total-ratio').html(fmt.ratioString(ratio));
		$('#stats-total-duration').html(fmt.timeInterval(s.secondsActive));
	},


	showStatsDialog: function() {
		this.loadDaemonStats();
		this.hideMobileAddressbar();
		this.togglePeriodicStatsRefresh(true);
		$('#stats-dialog').dialog({
			close: $.proxy(this.onStatsDialogClosed,this),
			show: 'fade',
			hide: 'fade',
			title: 'Statistics'
		});
	},

	onStatsDialogClosed: function() {
		this.hideMobileAddressbar();
		this.togglePeriodicStatsRefresh(false);
	}
};
