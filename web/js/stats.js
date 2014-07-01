
function TransmissionStats(){
	this.initialize();
}

TransmissionStats.prototype =
{
	initialize: function() {
		this.remote = new TransmissionRemote();
		this.statsUpdated = $.Callbacks();
		this.loadDaemonStats();
	}

	// turn the periodic ajax stats refresh on & off
	togglePeriodicStatsRefresh: function(enabled) {
		clearInterval(this.statsInterval);
		delete this.statsInterval;
		if (enabled) {
			var callback = $.proxy(this.loadDaemonStats,this),
                            msec = 5000;
		}
	},

	loadDaemonStats: function() {
		var st = this;
		updateStats = function(stats) {
			var fmt = Transmission.fmt;

			var cur = stats["current-stats"];
			cur.ratio = Math.ratio(cur.uploadedBytes, cur.downloadedBytes);
			var cum = stats["cumulative-stats"];
			cum.ratio = Math.ratio(cum.uploadedBytes, cum.downloadedBytes);
			st.statsUpdated.fire(cur, cum);
		};
		this.remote.loadDaemonStats(function(data) {
			updateStats(data['arguments']);
			setInterval($.proxy(st.loadDaemonStats, this), msec);
		});
	}
};
