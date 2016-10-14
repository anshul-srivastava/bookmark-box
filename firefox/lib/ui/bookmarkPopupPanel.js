var self = require("sdk/self");
var tabs = require("sdk/tabs");
var simpleStorage = require("sdk/simple-storage");
var panels = require("sdk/panel");

var panelObj = null;


function Panel(bookmarkApi) {

	var redirectUrl = 'https://anshul-srivastava.github.io/bookmark-box/bookmark-box-oauth-files/oauthreceiver.html';

	var panel = panels.Panel({
		contentURL: self.data.url("popup.html"),
		contentScriptOptions: {
			redirectUrl: redirectUrl,
			DropboxOAuth: simpleStorage.storage.DropboxOAuth,
			lastSyncTime: simpleStorage.storage.lastSyncTime
		}
	});


	panel.port.on('dropboxAuthenticate', function(data) {
		tabs.open({
			url: data.authUrl,
			onOpen: function onOpen(tab) {
				tab.on('ready', function(tab) {
					console.log('tab.url ==>', tab.url);
					var index = tab.url.indexOf(redirectUrl);
					console.log('index of==>', index);
					if (index === 0) {
						console.log('authenticated tab url ==>', tab.url);
						var queryString = tab.url.substring(redirectUrl.length + 1);
						var queryStringParts = queryString.split('&');
						var queryObj = {};
						for (var i = 0; i < queryStringParts.length; i++) {
							var parts = queryStringParts[i].split('=');
							if (parts.length === 2) {
								queryObj[parts[0]] = parts[1];
							}
						}
						console.log(queryObj);
						var contentScriptFile = 'dropboxoauthhtmls/js/tabContentScriptSuccess.js'
						if (queryObj.error) {
							contentScriptFile = 'dropboxoauthhtmls/js/tabContentScriptFail.js'
						}
						tab.attach({
							contentScriptFile: self.data.url(contentScriptFile),
							onMessage: function(message) {
								console.log(message);
							},
							onError: function(error) {
								console.log(error.fileName + ":" + error.lineNumber + ": " + error);
							}
						});
						panel.port.emit('dropboxAuthenticateStatus', {
							timestamp: data.timestamp,
							params: queryObj
						});
					}
				});
			}
		});
	});

	panel.port.on('saveCredentials', function(credentials) {
		console.log('in here');
		simpleStorage.storage.DropboxOAuth = credentials
	});

	panel.port.on('setLastTimeSync', function(data) {
		simpleStorage.storage.lastSyncTime = data.lastSyncTime;
	});

	panel.port.on('dropboxSignOut', function(data) {
		delete simpleStorage.storage.DropboxOAuth;
		delete simpleStorage.storage.lastSyncTime;
		bookmarkApi.close();
	});



	this.getPanelInstance = function() {
		return panel;
	};

	this.showPanel = function(toggleButton, height, width) {
		panel.show({
			width: width,
			height: height,
			position: toggleButton
		});
	};
	this.hidePanel = function() {
		panel.hide();
	}

	this.isPanelVisible = function() {
		return panel.isShowing;
	}

	// handling browser bookmark related stuff
	bookmarkApi.setEventsListener({
		onCreate: function(parentList, bookmarkNode, isToolbarEntry) {
			panel.port.emit('bookmarkOnCreate', {
				parentList: parentList,
				bookmarkNode: bookmarkNode,
				isToolbarEntry: isToolbarEntry
			});
		},
		onUpdate: function(parentList, bookmarkNode, siblingFolders, siblingBookmarks, isBookmark, isToolbarEntry) {
			panel.port.emit('bookmarkOnUpdate', {
				parentList: parentList,
				bookmarkNode: bookmarkNode,
				siblingFolders: siblingFolders,
				siblingBookmarks: siblingBookmarks,
				isBookmark: isBookmark,
				isToolbarEntry: isToolbarEntry
			});
		},
		onRemove: function(parentNode, parentList, siblings, isToolbarEntry) {
			panel.port.emit('bookmarkOnRemove', {
				parentNode: parentNode,
				parentList: parentList,
				siblings: siblings,
				isToolbarEntry: isToolbarEntry
			});
		},
		onMove: function(movedNode, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry, isBookmark) {

			panel.port.emit('bookmarkOnMove', {
				movedNode: movedNode,
				newParentList: newParentList,
				isNewEntryToolbarEntry: isNewEntryToolbarEntry,
				oldParentList: oldParentList,
				isOldEntryToolbarEntry: isOldEntryToolbarEntry,
				isBookmark: isBookmark
			});
		}
	});

	panel.port.on('browserAddBookmarkToolbar', function(data) {
		var bookmarkNode = bookmarkApi.addBookmarkToToolbar(data.parentList, data.title, data.url);
		var err = null;
		if (!bookmarkNode) {
			err = true;
		}
		panel.port.emit('browserBookmarkAddedToolbar', {
			timestamp: data.timestamp,
			err: err,
			bookmarkNode: bookmarkNode
		});
	});

	panel.port.on('browserAddBookmarkDefaultFolder', function(data) {
		var bookmarkNode = bookmarkApi.addBookmarkToDefaultFolder(data.parentList, data.title, data.url);
		var err = null;
		if (!bookmarkNode) {
			err = true;
		}
		panel.port.emit('browserBookmarkAddedDefaultFolder', {
			timestamp: data.timestamp,
			err: err,
			bookmarkNode: bookmarkNode
		});
	});

	panel.port.on('browserGetNodeParentList', function(data) {
		var parentsData = bookmarkApi.getNodeParentsData(data.node);
		var err = null;
		if (!parentsData) {
			err = true;
		}
		panel.port.emit('browserNodeParentList', {
			timestamp: data.timestamp,
			err: err,
			node: data.node,
			parentList: parentsData.parentList,
			isToolbarEntry: parentsData.toolbarEntry
		});
	});

	panel.port.on('browserGetChildren', function(data) {
		var childrenList = bookmarkApi.getChildren(data.nodeId);
		var err = null;
		if (!childrenList) {
			err = true;
		}
		panel.port.emit('browserNodeChildrenList', {
			timestamp: data.timestamp,
			err: err,
			childrenList: childrenList

		});
	});

	panel.port.on('browserRemoveNode', function(data) {
		bookmarkApi.removeNode(data.node);
	});

	panel.port.on('browserClose', function(data) {
		bookmarkApi.close();
	});

}

exports.getPanel = function(bookmarkApi) {
	// popup panel
	if (!panelObj) {
		panelObj = new Panel(bookmarkApi);
	}
	return panelObj;
};