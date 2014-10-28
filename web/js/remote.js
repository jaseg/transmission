/**
 * Copyright 2014 © Jordan Lee, Dave Perrett, Malcolm Jarvis and Bruno Bierbaumer
 *
 * This file is licensed under the GPLv2.
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 */

var RPC = {
	_Root                   : '/transmission/rpc',
};

function TransmissionRemote(controller)
{
	/* Display an error if an ajax request fails, and stop sending requests
	 * or on a 409, globally set the X-Transmission-Session-Id and resend */
	this.ajaxError = function(request, error_string, exception, ajaxObject) {
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
	};

	/* Utility functions */
	this.sendRequest = function(data, callback, async) {
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
	};

	this.rpcCall = function(method, args, callback){
		this.sendRequest({'method': method, 'arguments': args}, function(response){
			callback(response['arguments'], response);
		});
	};

	this.sendTorrentSetRequests = function(method, torrents, args, callback) {
		args = args ? args : {};
		if (torrents){
			if (typeof torrents === 'Array' && typeof torrents[0] === 'Torrent')
				args['ids'] = $.map(torrents, function(i, tor){ return tor.getId(); });
			else
				args['ids'] = torrents;
		}
		this.rpcCall(method, args, callback);
	};

	this.loadDaemonPrefs = function(callback) {
		this.rpcCall('session-get', {}, callback);
	};
	
	this.checkPort = function(callback) {
		this.rpcCall('port-test', {}, callback);
	};

	this.loadDaemonStats = function(callback) {
		this.rpcCall('session-stats', {}, callback);
	};

	/* torrent_ids can be null for all torrents or be a string such as "recently-active" */
	this.updateTorrents = function(torrent_ids, fields, callback) {
		/* Always fetch the "id" field for identification */
		this.sendTorrentSetRequests('torrent-get', torrent_ids, {'fields': fields.concat(['id'])}, function(res){
			callback(res['torrents'], res['removed']);
		});
	};

	this.getFreeSpace = function(callback) {
		this.rpcCall('free-space', {}, function(res) {
			callback(res.arguments['size-bytes']);
		});
	};

	this.changeFileCommand = function(torrent_id, args) {
		this.sendTorrentSetRequests('torrent-set', [torrent_id], args);
		this.torrentsCallbacks.fire();
	};

	this.startTorrents = function(torrent_ids, bypass_queue) {
		this.sendTorrentSetRequests('torrent-start', torrent_ids, {'bypass-queue': Boolean(bypass_queue)});
	};
	this.stopTorrents = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-stop', torrent_ids);
	};
	this.moveTorrents = function(torrent_ids, new_location){
		this.sendTorrentSetRequests('torrent-set-location', torrent_ids, {'move': true, 'location': new_location});
	};
	this.renameTorrent = function(torrent_ids, oldpath, newname, callback) {
		this.sendTorrentSetRequests('torrent-rename-path', torrent_ids, {'path': oldpath, 'name': newname }, function(res){
			callback(res.result, res.arguments);
		});
	};
	this.removeTorrents = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-remove', torrent_ids);
	};
	this.removeTorrentsAndData = function(torrents) {
		this.sendTorrentSetRequests('torrent-remove', torrents, {'delete-local-data': true});
	};
	this.verifyTorrents = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-verify', torrent_ids, callback);
	};
	this.reannounceTorrents = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('torrent-reannounce', torrent_ids, callback);
	};
	this.addTorrentByUrl = function(url, paused) {
		if (url.match(/^[0-9a-f]{40}$/i))
			url = 'magnet:?xt=urn:btih:'+url;
		this.rpcCall('torrent-add', {'paused': paused, 'filename': url});
	};
	this.savePrefs = function(args, callback) {
		console.log("savePrefs called (disabled for debugging)");
		/* FIXME DISABLED FOR TESTING
		this.rpcCall('session-set', args, callback);
		*/
	};
	this.savePref = function(name, value, callback){
		console.log("savePref called (disabled for debugging)");
		/* FIXME DISABLED FOR TESTING
		var prefs = {};
		prefs[name] = value;
		this.savePrefs(prefs, callback);
		*/
	};
	this.updateBlocklist = function() {
		this.rpcCall('blocklist-update', {});
	};

	// Added queue calls
	this.moveTorrentsToTop = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-top', torrent_ids, callback);
	};
	this.moveTorrentsToBottom = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-bottom', torrent_ids, callback);
	};
	this.moveTorrentsUp = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-up', torrent_ids, callback);
	};
	this.moveTorrentsDown = function(torrent_ids, callback) {
		this.sendTorrentSetRequests('queue-move-down', torrent_ids, callback);
	};

	this._token = '';
	this.errorCallbacks = $.Callbacks(); /* Fired when an AJAX error occurs */
	this.torrentsCallbacks = $.Callbacks(); /* Fired when the torrent list changes */
}
