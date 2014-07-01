/**
 * Copyright © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

var RPC = {
	_DaemonVersion          : 'version',
	_Root                   : '/transmission/rpc',
};

function TransmissionRemote(controller)
{
	this.initialize(controller);
	return this;
}

TransmissionRemote.prototype =
{
	/*
	 * Constructor
	 */
	initialize: function() {
		this._token = '';
		this.errorCallbacks = $.Callbacks(); /* Fired when an AJAX error occurs */
		this.torrentsCallbacks = $.Callbacks(); /* Fired when the torrent list changes */
	},

	/* Display an error if an ajax request fails, and stop sending requests
	 * or on a 409, globally set the X-Transmission-Session-Id and resend */
	ajaxError: function(request, error_string, exception, ajaxObject) {
		var token = request.getResponseHeader('X-Transmission-Session-Id');

		// set the Transmission-Session-Id on a 409
		if (request.status === 409 && token){
			this._token = token;
			$.ajax(ajaxObject);
			return;
		}

		var err = request.responseText
				? request.responseText.trim().replace(/(<([^>]+)>)/ig,"")
				: "";
		if (!err.length)
			err = 'Server not responding';

		this.errorCallbacks.fire(err);
	},

	/* Utility functions */
	sendRequest: function(data, callback, async) {
		var remote = this;
		async = async !== 'undefined' ? async : true;

		var ajaxSettings = {
			url: RPC._Root,
			type: 'POST',
			contentType: 'json',
			dataType: 'json',
			cache: false,
			data: JSON.stringify(data),
			beforeSend: function(XHR){
				if (remote._token)
					XHR.setRequestHeader('X-Transmission-Session-Id', remote._token);
			},
			error: function(request, error_string, exception){
				remote.ajaxError(request, error_string, exception, ajaxSettings);
			},
			success: callback,
			async: async
		};

		$.ajax(ajaxSettings);
	},

	rpcCall: function(method, args, callback){
		args['method'] = method;
		this.sendRequest(args, function(response){
			callback(response['arguments'], response);
		});
	},

	sendTorrentSetRequests: function(method, torrents, args) {
		args = args ? args : {};
		if (typeof torrents === 'Array' && typeof torrents[0] === 'Torrent')
			args['ids'] = $.map(torrents, function(i, tor){ return tor.getId(); });
		else
			args['ids'] = torrents;
		this.rpcCall(method, args);
	},

	loadDaemonPrefs: function(callback) {
		this.rcpCall('session-get', {}, callback);
	},
	
	checkPort: function(callback) {
		this.rcpCall('port-test', {}, callback);
	},

	loadDaemonStats: function(callback) {
		this.rpcCall('session-stats', {}, callback);
	},

	/* torrent_ids can be null for all torrents or be a string such as "recently-active" */
	updateTorrents: function(torrent_ids, fields, callback) {
		/* Always fetch the "id" field for identification */
		this.sendTorrentSetRequests('torrent-get', torrent_ids, {'fields': fields.concat(['id'])}, function(res){
			callback(res['torrents'], res['removed']);
		});
	},

	getFreeSpace: function(callback) {
		this.rpcCall('free-space', {}, function(res) {
			callback(res.arguments['size-bytes']);
		});
	},

	changeFileCommand: function(torrent_id, args) {
		this.sendTorrentSetRequests('torrent-set', [torrent_id], args);
		this.torrentsCallbacks.fire();
	},

	startTorrents: function(torrent_ids, bypass_queue) {
		this.sendTorrentSetRequests('torrent-start', torrent_ids, {'bypass-queue': Boolean(bypass_queue)});
	},
	stopTorrents: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-stop', torrent_ids);
	},
	moveTorrents: function(torrent_ids, new_location){
		this.sendTorrentSetRequests('torrent-set-location', torrent_ids, {'move': true, 'location': new_location});
	},
	renameTorrent: function(torrent_ids, oldpath, newname, callback) {
		this.sendTorrentSetRequests('torrent-rename-path', torrent_ids, {'path': oldpath, 'name': newname }, function(res){
			callback(res.result, res.arguments);
		});
	},
	removeTorrents: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-remove', torrent_ids);
	},
	removeTorrentsAndData: function(torrents) {
		this.sendTorrentSetRequests('torrent-remove', torrents, {'delete-local-data': true});
	},
	verifyTorrents: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-verify', torrent_ids, callback);
	},
	reannounceTorrents: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-reannounce', torrent_ids, callback);
	},
	addTorrentByUrl: function(url, paused) {
		if (url.match(/^[0-9a-f]{40}$/i))
			url = 'magnet:?xt=urn:btih:'+url;
		this.rpcCall('torrent-add', {'paused': paused, 'filename': url});
	},
	savePrefs: function(args, callback) {
		console.log("savePrefs called (disabled for debugging)");
		/* FIXME DISABLED FOR TESTING
		this.rpcCall('session-set', args, callback);
		*/
	},
	savePref: function(name, value, callback){
		console.log("savePref called (disabled for debugging)");
		/* FIXME DISABLED FOR TESTING
		var prefs = {};
		prefs[name] = value;
		this.savePrefs(prefs, callback);
		*/
	},
	updateBlocklist: function() {
		this.rpcCall('blocklist-update', {});
	},

	// Added queue calls
	moveTorrentsToTop: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-top', torrent_ids, callback);
	},
	moveTorrentsToBottom: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-bottom', torrent_ids, callback);
	},
	moveTorrentsUp: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-up', torrent_ids, callback);
	},
	moveTorrentsDown: function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-down', torrent_ids, callback);
	}
};
