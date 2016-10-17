(
	function(window) {

		var callbackList = {};
		var bookmarkDatastore = null;
		var firefoxBookmarkMessenger = null;

		if(!window.DATASTORE_MANAGER) {
			console.log('Unable to load dropbox api');
			return;
		}

		var firefoxauthDriver = new FFExtDropboxAuthdriver('xlwyafffvnbpiez',addon.options.redirectUrl, function(options, callback) {
			var timestamp = new Date().getTime();
			callbackList[timestamp] = callback;
			addon.port.emit('dropboxAuthenticate', {
				timestamp: timestamp,
				authUrl: options.authUrl,
				stateParam: options.state
			});
		});
		var datastoreManager = new DatastoreManager('xlwyafffvnbpiez', addon.options.DropboxOAuth, firefoxauthDriver, function(dropboxCredentials) {
			addon.port.emit('saveCredentials', dropboxCredentials);
		});


		addon.port.on('dropboxAuthenticateStatus', function(data) {
			var callback = callbackList[data.timestamp];
			if (callback) {
				delete callbackList[data.timestamp];
				callback(null, data.params);
			}
		});

		function setBrowserEventListener() {

			addon.port.on('bookmarkOnCreate', function(data) {
				if (!bookmarkDatastore) {
					return;
				}
				if (data.bookmarkNode.url) {
					if (data.isToolbarEntry) {
						var record = bookmarkDatastore.createBookmarkEntryInToolbar(data.parentList, data.bookmarkNode.title, data.bookmarkNode.url);
					} else {
						var record = bookmarkDatastore.createBookmarkEntry(data.parentList, data.bookmarkNode.title, data.bookmarkNode.url);
					}
				} else {
					if (data.isToolbarEntry) {
						bookmarkDatastore.createFolderEntryInToolbar(data.parentList, data.bookmarkNode.title);
					} else {
						bookmarkDatastore.createFolderEntry(data.parentList, data.bookmarkNode.title);
					}
				}
				bookmarkDatastore.commit();
			});

			addon.port.on('bookmarkOnUpdate', function(data) {
				if (!bookmarkDatastore) {
					return;
				}
				var parentRecordId = null;
				if (data.isToolbarEntry) {
					parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlistForToolbar(data.parentList);
				} else {
					parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlist(data.parentList);
				}
				if (parentRecordId) {
					var childrenRecords;
					var siblings;
					if (data.isBookmark) {
						childrenRecords = bookmarkDatastore.getChildrenBookmarks(parentRecordId);
						siblings = data.siblingBookmarks;
					} else {
						childrenRecords = bookmarkDatastore.getChildrenFolders(parentRecordId);
						siblings = data.siblingFolders;
					}
					for (var i = 0; i < siblings.length; i++) {
						var siblingFound = false;
						for (var j = 0; j < childrenRecords.length; j++) {
							if (data.isBookmark) {
								if (childrenRecords[j].get('title') === siblings[i].title && childrenRecords[j].get('url') === siblings[i].url) {
									siblingFound = true;
									break;
								} else {
									siblingFound = false;
								}
							} else {
								if (childrenRecords[j].get('title') === siblings[i]) {
									siblingFound = true;
									break;
								} else {
									siblingFound = false;
								}
							}
						}
						if (siblingFound) {
							childrenRecords.splice(j, 1);
						}
					}
					// hoping only one record doesnt match .... need to retrospect further on the basis of timestamp maybe
					if (childrenRecords.length == 1) {
						if (data.isBookmark) {
							bookmarkDatastore.updateBookmarkEntry(childrenRecords[0], data.bookmarkNode.title, data.bookmarkNode.url);
						} else {
							bookmarkDatastore.updateFolderEntry(childrenRecords[0], data.bookmarkNode.title);
						}
					}
				}
				bookmarkDatastore.commit();
			});

			addon.port.on('bookmarkOnRemove', function(data) {
				if (!bookmarkDatastore) {
					return;
				}
                 
				if (!bookmarkDatastore.lastSyncSuccessFull()) {
					console.log('not synced returning');
					return;
				}
				var parentRecordId = null;
				if (data.isToolbarEntry) {
					parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlistForToolbar(data.parentList);
				} else {
					parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlist(data.parentList);
				}
				if (parentRecordId) {
					var childrenRecords;
					childrenRecords = bookmarkDatastore.getChildren(parentRecordId);
					var deletedBookmarkRecords = [];
					var deletedFolderRecords = [];
					for (var i = 0; i < childrenRecords.length; i++) {
						var found = false;
						var isBookmark = false;
						if (childrenRecords[i].get('url')) {
							isBookmark = true;
						}
						for (var j = 0; j < data.siblings.length; j++) {
							if (isBookmark) { // is bookmark
								if (childrenRecords[i].get('title') === data.siblings[j].title && childrenRecords[i].get('url') === data.siblings[j].url) {
									found = true;
									break;
								}
							} else {
								if (childrenRecords[i].get('title') === data.siblings[j].title) {
									found = true;
									break;
								}
							}

						}
						if (!found) {
							if (isBookmark) {
								bookmarkDatastore.removeBookmarkRecord(childrenRecords[i]);
							} else {
								bookmarkDatastore.removeFolderRecord(childrenRecords[i]);
							}
						}
					}
				}
				bookmarkDatastore.commit();
			});

			addon.port.on('bookmarkOnMove', function(data) {
				if (!bookmarkDatastore) {
					return;
				}
				var ret;
				if (data.isBookmark) {
					ret = bookmarkDatastore.moveBookmark(data.movedNode.title, data.movedNode.url, data.newParentList, data.isNewEntryToolbarEntry, data.oldParentList, data.isOldEntryToolbarEntry);
				} else {
					ret = bookmarkDatastore.moveFolder(data.movedNode.title, data.newParentList, data.isNewEntryToolbarEntry, data.oldParentList, data.isOldEntryToolbarEntry);
				}
				bookmarkDatastore.commit();

			});



		}


		function setup(callback) {
			console.log('setting up');
			datastoreManager.openBookmarkDatastore(function(err, bookmarkDS) {
				if (err) {
					console.log("error opening bookmark datastore ==>", err);
					if (err.status && err.status == 401) {
						addon.port.emit('dropboxSignOut');
						callback(null, false);
					} else {
						callback(err, false);
					}
					return;
				}
				bookmarkDatastore = bookmarkDS;
				//console.log('deleting all');
				//bookmarkDatastore.deleteAll();
				if (!firefoxBookmarkMessenger) {
					firefoxBookmarkMessenger = new FirefoxBookmarkMessenger();
					setBrowserEventListener();
					bookmarkDatastore.setLastSyncTime(addon.options.lastSyncTime);
					bookmarkDatastore.setLastSyncTimeUpdateFunc(function(lastSyncTime) {
						addon.port.emit('setLastTimeSync', {
							lastSyncTime: lastSyncTime
						});
					});

					bookmarkDatastore.setBookmarkApi(firefoxBookmarkMessenger);
					bookmarkDatastore.syncBookmarks();
				}
				callback(null, true);

			});
		}

		var authenticationMessenger = null;
		var AuthenticationMessenger = function() {

			this.isAuthenticated = function(callback) {
				if (datastoreManager.isAuthenticated()) {
					setup(function(err, status) {
						console.log('status ==>',status);
						callback(null,status);
					});
				} else {
					callback(null, false);
				}
			};

			this.signIn = function(callback) {
				datastoreManager.authenticate(function(err, cli) {
					var signInStatus = true;
					if (err) {
						console.log('Authentication Error');
						console.log(err);
						signInStatus = false;
						callback(err, signInStatus);
						return;
					}
					console.log('calling setup');
					setup(function(err, status) {});
					callback(err, signInStatus);
				});
			}

			this.signOut = function(callback) {
				if (bookmarkDatastore) {
					bookmarkDatastore = null;
				}
				datastoreManager.signOut(function() {
					addon.port.emit('dropboxSignOut');
					if (firefoxBookmarkMessenger) {
						//firefoxBookmarkMessenger.close();
						firefoxBookmarkMessenger = null;
					}
					callback();
				});
			}


		}

		addon.port.on('browserBookmarkAddedToolbar', function(data) {
			var callback = callbackList[data.timestamp];
			if (callback) {
				delete callbackList[data.timestamp];
				callback(data.err, data.bookmarkNode);
			}
		});

		addon.port.on('browserBookmarkAddedDefaultFolder', function(data) {
			var callback = callbackList[data.timestamp];
			if (callback) {
				delete callbackList[data.timestamp];
				callback(data.err, data.bookmarkNode);
			}
		});

		addon.port.on('browserNodeParentList', function(data) {
			var callback = callbackList[data.timestamp];
			if (callback) {
				delete callbackList[data.timestamp];
				callback(data.err, data.node, data.parentList, data.isToolbarEntry);
			}
		});

		addon.port.on('browserNodeChildrenList', function(data) {
			var callback = callbackList[data.timestamp];
			if (callback) {
				delete callbackList[data.timestamp];
				callback(data.err, data.childrenList);
			}
		});

		var FirefoxBookmarkMessenger = function() {


			this.addBookmarkToToolbar = function(parentList, title, url, callback) {
				var timestamp = new Date().getTime();
				callbackList[timestamp] = callback;
				addon.port.emit('browserAddBookmarkToolbar', {
					timestamp: timestamp,
					parentList: parentList,
					title: title,
					url: url
				});
			};

			this.addBookmarkToDefaultFolder = function(parentList, title, url, callback) {
				var timestamp = new Date().getTime();
				callbackList[timestamp] = callback;
				addon.port.emit('browserAddBookmarkDefaultFolder', {
					timestamp: timestamp,
					parentList: parentList,
					title: title,
					url: url
				});
			};

			this.getNodeParentList = function(node, callback) {
				var timestamp = new Date().getTime();
				callbackList[timestamp] = callback;
				addon.port.emit('browserGetNodeParentList', {
					timestamp: timestamp,
					node: node
				});
			};

			this.getChildren = function(nodeId, callback) {
				var timestamp = new Date().getTime();
				callbackList[timestamp] = callback;
				addon.port.emit('browserGetChildren', {
					timestamp: timestamp,
					nodeId: nodeId
				});

			};

			this.removeNode = function(node) {
				var timestamp = new Date().getTime();
				addon.port.emit('browserRemoveNode', {
					timestamp: timestamp,
					node: node
				});
			};

			this.close = function() {
				var timestamp = new Date().getTime();
				addon.port.emit('browserClose', {
					timestamp: timestamp,
					node: node
				});
			};


		}

		window.getAuthenticationMessenger = function() {

			if (!authenticationMessenger) {
				authenticationMessenger = new AuthenticationMessenger();
			}
			return authenticationMessenger;
		}

	}
)(window);