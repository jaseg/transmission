var Notifications = {};

$(document).ready(function () {
	if (!window.webkitNotifications)
		return;

	var notificationsEnabled = (window.webkitNotifications.checkPermission() == 0);

	transmission.downloadComplete.add(function(torrent) {
		if (notificationsEnabled) {
			var notification = window.webkitNotifications.createNotification('css/transmission/images/logo.png',
																			 'Download complete',
																			 torrent.getName());
			notification.show(); 
			setTimeout(function () {
				notification.cancel();
			}, 5000);
		};
	});

	Notifications.setEnabled = function (yes) {
		if(yes){
			if (window.webkitNotifications.checkPermission() !== 0) {
				window.webkitNotifications.requestPermission(function () {
					notificationsEnabled = (window.webkitNotifications.checkPermission() == 0);
			});
			notificationsEnabled = true;
		} else {
			notificationsEnabled = false;
		}
	};
});
