(
	function(window) {


		window.BookmarkDatastore = function(ds) {

			//var sequencer = new Sequencer(); 

			var toolbarFolderId = "/#toolbar-folder#/"; // id for toolbar folder
			var defaultFolderId = "/#default-folder#/"; // id for default folder

			var datastore = ds; // data store instance
			var folderTable = null; //refernece for folder table
			var bookmarkTable = null;

			var lastSyncTime = null;
			var syncedSinceBoot = false;
			var lastSyncSuccess = false;
			var updateLastSyncTimeFunc = null;


			var that = this;
			var browserBookmarkApi;

			folderTable = datastore.getTable('folders');
			bookmarkTable = datastore.getTable('bookmarks');

			datastore.recordsChanged.addListener(function(event) {
				console.log('datastore event fired');
				if (event.isLocal()) {
					console.log('datastore event is local');
				} else {
					console.log('datastore event is remote');
					that.syncBookmarks();
				}

			});

			/*
     This is function returns a javascript Object for a folder record that can be passed to the datastore api
    */
			function createFolderRecordJsonObj(parentId, title) {
				var recordObj = {};
				if (parentId) {
					recordObj.parentId = parentId;
				}
				if (title) {
					recordObj.title = title;
				}

				return recordObj;

			}
			/*
     This is function returns a javascript Object for bookmark record that can be passed to the datastore api
    */
			function createBookmarkRecordJsonObj(parentId, url, title) {
				var obj = {};
				if (parentId) {
					obj.parentId = parentId;
				}
				if (url) {
					obj.url = url;
				}
				if (title) {
					obj.title = title;
				}
				return obj;
			}

			function insertEntry(table, data) {
				data.dateCreated = new Date().getTime();
				return table.insert(data);

			}

			function updateFolderContentChangeTime(recordId) {
				if (!recordId) {
					return;
				}
				if (recordId === defaultFolderId || recordId === toolbarFolderId) {
					return;
				}
				var record = folderTable.get(recordId);
				if (!record) {
					return;
				}
				record.set('dateContentChanged', new Date().getTime());
				return;

			}


			/**
	This function finds the parent record of a bookmark or folder.
	It takes a array of parentNames starting with grandparent at index 0 (root folder not included) and a boolean
	whether to create parent record if not found
	**/

			var findParentRecord = function(rootFolderId, parentList, createParent) { //need to check what if parentList is NUll
				var parentRecord;
				var parentId = rootFolderId;
				while (parentList.length) {
					var recordsFetched = folderTable.query(createFolderRecordJsonObj(parentId, parentList[0]));
					if (recordsFetched.length) { //grand parent record found
						parentRecord = recordsFetched[0];
						parentId = parentRecord.getId();
						parentList.splice(0, 1);
						if (parentList.length === 0) { //parent found
							return parentRecord;
						}
					} else { // no parent found 
						if (createParent) { // create folder ??
							var folderRecord = insertEntry(folderTable, createFolderRecordJsonObj(parentId, parentList[0]));
							if (folderRecord) {
								updateFolderContentChangeTime(parentId);
							}
							parentRecord = folderRecord;
							parentId = parentRecord.getId();
							parentList.splice(0, 1);
							if (parentList.length === 0) { // parent created
								return parentRecord;
							}
						} else {
							return null; // no parent found
						}
					}
				}
			}

			var findParentList = function(record) {
				var parentId = record.get('parentId');
				var parentList = [];
				while (parentId != defaultFolderId && parentId != toolbarFolderId) {
					var parentRecord = folderTable.get(parentId);
					if (parentList) {
						parentList.push(parentRecord.get('title'));
						parentId = parentRecord.get('parentId');
					} else {
						return null; // something wrong in folder hierarchy
					}
				}
				var isToolbarEntry = false;
				if (parentId === toolbarFolderId) {
					isToolbarEntry = true;
				}

				return {
					toolbarEntry: isToolbarEntry,
					parentList: parentList.reverse()
				};

			}

			/**
    This method inserts a folder entry into the folder table
    **/
			var insertFolderEntry = function(rootFolderId, parentList, title) {
				if (!datastore) {
					return false;
				}
				var parentId = rootFolderId;
				if (parentList && parentList.length) {
					var parentFolderRecord = findParentRecord(rootFolderId, parentList, true);
					if (parentFolderRecord) { // use root Id
						parentId = parentFolderRecord.getId();
					} else {
						parentId = null;
					}
				}
				if (parentId) {
					//checking for duplicate entry;
					var folderRecordJsonObj = createFolderRecordJsonObj(parentId, title);
					var recordsFetched = folderTable.query(folderRecordJsonObj);
					if (!(recordsFetched && recordsFetched.length)) { // record exists ???
						var folderRecord = insertEntry(folderTable, folderRecordJsonObj);
						if (folderRecord) {
							updateFolderContentChangeTime(parentId);
						}
						return folderRecord;
					} else {
						return recordsFetched[0];
					}

				} else {
					return null;
				}

			}

			this.createFolderEntryInToolbar = function(parentList, title) {
				return insertFolderEntry(toolbarFolderId, parentList, title);
			};

			this.createFolderEntry = function(parentList, title) {
				return insertFolderEntry(defaultFolderId, parentList, title);
			};



			var insertBookmarkEntry = function(rootFolderId, parentList, title, url) {
				if (!datastore) {
					return false;
				}
				var parentId = rootFolderId;
				if (parentList && parentList.length) {
					var parentFolderRecord = findParentRecord(rootFolderId, parentList, true);
					if (parentFolderRecord) {
						parentId = parentFolderRecord.getId();
					} else {
						parentId = null;
					}
				}
				if (parentId) {
					//checking for duplicate entry
					var bookmarkJsonObj = createBookmarkRecordJsonObj(parentId, url, title);
					var recordsFetched = bookmarkTable.query(bookmarkJsonObj);
					if (!(recordsFetched && recordsFetched.length)) { // record exists
						var bookmarkRecord = insertEntry(bookmarkTable, bookmarkJsonObj);
						if (bookmarkRecord) {
							updateFolderContentChangeTime(parentId);
						}
						return bookmarkRecord;
					} else {
						return recordsFetched[0];
					}
				} else {
					return null;
				}
			};


			this.createBookmarkEntryInToolbar = function(parentList, title, url) {
				return insertBookmarkEntry(toolbarFolderId, parentList, title, url);
			};

			this.createBookmarkEntry = function(parentList, title, url) {
				return insertBookmarkEntry(defaultFolderId, parentList, title, url);
			};

			this.getChildrenFolders = function(parentId) {
				if (!parentId) {
					parentId = defaultFolderId;
				} else {
					if (parentId === 'toolbar') {
						parentId = toolbarFolderId;
					}
				}
				var folderRecordJsonObj = createFolderRecordJsonObj(parentId);
				var recordsFetched = folderTable.query(folderRecordJsonObj);
				if (recordsFetched) {
					return recordsFetched;
				} else {
					return null;
				}
			}

			this.getChildrenBookmarks = function(parentId) {
				if (!parentId) {
					parentId = defaultFolderId;
				} else {
					if (parentId === 'toolbar') {
						parentId = toolbarFolderId;
					}
				}
				var bookmarkJsonObj = createBookmarkRecordJsonObj(parentId);
				var recordsFetched = bookmarkTable.query(bookmarkJsonObj);
				if (recordsFetched) {
					return recordsFetched;
				} else {
					return null;
				}
			}


			// need to think abount optimization later
			this.getChildren = function(parentId) {
				if (!parentId) {
					parentId = defaultFolderId;
				} else {
					if (parentId === 'toolbar') {
						parentId = toolbarFolderId;
					}
				}
				var list = [];
				var folders = this.getChildrenFolders(parentId);
				if (folders != null) {
					list = list.concat(folders);
				}

				var bookmarks = this.getChildrenBookmarks(parentId);
				if (bookmarks != null) {
					list = list.concat(bookmarks);
				}
				return list;
			}



			var getParentRecordId = function(rootFolderId, parentList) {
				var parentId = rootFolderId;
				if (parentList && parentList.length) {
					var parentFolderRecord = findParentRecord(rootFolderId, parentList, true);
					return parentFolderRecord.getId();
				} else {
					return parentId;
				}
			}

			this.getParentRecordIdFromParentlist = function(parentList) {
				return getParentRecordId(defaultFolderId, parentList);
			}

			this.getParentRecordIdFromParentlistForToolbar = function(parentList) {
				return getParentRecordId(toolbarFolderId, parentList);
			}

			this.updateFolderEntry = function(recordToUpdate, newTitle) {
				if (!datastore) {
					return false;
				}
				recordToUpdate.set('title', newTitle);
				recordToUpdate.set('dateUpdated', new Date().getTime());

				var parentId = recordToUpdate.get('parentId');
				updateFolderContentChangeTime(parentId);
			};

			this.updateBookmarkEntry = function(recordToUpdate, newTitle, newUrl) {
				if (!datastore) {
					return false;
				}
				recordToUpdate.set('title', newTitle);
				recordToUpdate.set('url', newUrl);
				recordToUpdate.set('dateUpdated', new Date().getTime());

				var parentId = recordToUpdate.get('parentId');
				updateFolderContentChangeTime(parentId);
			}

			this.removeFolderRecord = function(folderRecord) {
				var bookmarkEntries = [];
				var folderEntries = [];
				var traverseFolderList = [];
				var parentId = null;
				if (folderRecord && folderRecord.getId()) {
					traverseFolderList.push(folderRecord);
					parentId = folderRecord.get('parentId');
				}


				while (traverseFolderList.length) {
					var folderRecord = traverseFolderList[0];
					var bookmarkRecords = this.getChildrenBookmarks(folderRecord.getId());
					if (bookmarkRecords && bookmarkRecords.length) {
						bookmarkEntries = bookmarkEntries.concat(bookmarkRecords);
					}
					var folders = this.getChildrenFolders(folderRecord.getId());
					if (folders && folders.length) {
						traverseFolderList = traverseFolderList.concat(folders);
					}
					traverseFolderList.splice(0, 1);
					folderEntries.push(folderRecord);
				}

				//deleting all the bookmarks enteries 
				for (var i = 0; i < bookmarkEntries.length; i++) {
					bookmarkEntries[i].deleteRecord();
				}
				//deleting all the folders enteries reverse order
				for (var i = folderEntries.length - 1; i >= 0; i--) {
					folderEntries[i].deleteRecord();
				}

				updateFolderContentChangeTime(parentId);

			}

			this.removeBookmarkRecord = function(bookmarkRecord) {
				if (bookmarkRecord) {
					var parentId = bookmarkRecord.get('parentId');
					bookmarkRecord.deleteRecord();
					updateFolderContentChangeTime(parentId);
				}
			}

			this.moveFolder = function(title, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry) {
				var newParentId = null;
				var oldParentId = null;
				if (isNewEntryToolbarEntry) {
					newParentId = toolbarFolderId;
				} else {
					newParentId = defaultFolderId;
				}
				if (isOldEntryToolbarEntry) {
					oldParentId = toolbarFolderId;
				} else {
					oldParentId = defaultFolderId;
				}

				if (newParentList && newParentList.length) {
					var newParentRecord = findParentRecord(newParentId, newParentList, true);
					if (newParentRecord) {
						newParentId = newParentRecord.getId();
					} else {
						return false;
					}
				}

				if (oldParentList && oldParentList.length) {
					var oldParentRecord = findParentRecord(oldParentId, oldParentList, false);
					if (oldParentRecord) {
						oldParentId = oldParentRecord.getId();
					} else {
						return false;
					}
				}

				var folderRecordJsonObj = createFolderRecordJsonObj(oldParentId, title);

				var recordsFetched = folderTable.query(folderRecordJsonObj);
				if (recordsFetched && recordsFetched.length) {
					recordsFetched[0].set('parentId', newParentId);
					recordsFetched[0].set('dateUpdated', new Date().getTime());
					updateFolderContentChangeTime(oldParentId);
					updateFolderContentChangeTime(newParentId);
					return true;
				} else {
					return false;
				}
			}

			this.moveBookmark = function(bookmarkTitle, url, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry) {
				var newParentId = null;
				var oldParentId = null;
				if (isNewEntryToolbarEntry) {
					newParentId = toolbarFolderId;
				} else {
					newParentId = defaultFolderId;
				}
				if (isOldEntryToolbarEntry) {
					oldParentId = toolbarFolderId;
				} else {
					oldParentId = defaultFolderId;
				}
				if (newParentList && newParentList.length) {
					var newParentRecord = findParentRecord(newParentId, newParentList, true);
					if (newParentRecord) {
						newParentId = newParentRecord.getId();
					} else {
						return false;
					}
				}

				if (oldParentList && oldParentList.length) {
					var oldParentRecord = findParentRecord(oldParentId, oldParentList, false);
					if (oldParentRecord) {
						oldParentId = oldParentRecord.getId();
					} else {
						return false;
					}
				}

				var bookmarkJsonObj = createBookmarkRecordJsonObj(oldParentId, url, bookmarkTitle);
				var recordsFetched = bookmarkTable.query(bookmarkJsonObj);
				if (recordsFetched && recordsFetched.length) {
					recordsFetched[0].set('parentId', newParentId);
					recordsFetched[0].set('dateUpdated', new Date().getTime());
					updateFolderContentChangeTime(oldParentId);
					updateFolderContentChangeTime(newParentId);
					return true;
				} else {
					return false;
				}
			}

			this.loopAllBookmarks = function(callback) {
				var bookmarkJsonObj = createBookmarkRecordJsonObj();
				var recordsFetched = bookmarkTable.query(bookmarkJsonObj);
				if (recordsFetched && recordsFetched.length) {
					recordsFetched.forEach(function(bookmarkRecord) {
						var ret = findParentList(bookmarkRecord);
						callback(ret.parentList, bookmarkRecord.get('url'), bookmarkRecord.get('title'), ret.toolbarEntry);
					});
				}
			}



			var sync = function(browserBookmarkApi, startId, syncCallback) {

				var foldersFound = [];
				var itemsToBeCreated = [];
				var itemsToBeDeleted = [];
				var itemsToBeCreatedInDataStore = [];
				//var lastSyncTime = localStorage.getItem('lastSyncTime');
				/*if (lastSyncTime) {
					lastSyncTime = parseInt(lastSyncTime);
				}*/


				function createItemInBrowser(callback) {
					if (itemsToBeCreated.length) {

						if (itemsToBeCreated[0].get('url')) { // is bookmark
							var ret = findParentList(itemsToBeCreated[0]);
							if (ret.toolbarEntry) {
								browserBookmarkApi.addBookmarkToToolbar(ret.parentList, itemsToBeCreated[0].get('title'), itemsToBeCreated[0].get('url'), function(err, bookmarkNode) {
									if (err) {
										return;
									}
									//console.log('bookmark added to toolbar folder');
									itemsToBeCreated.splice(0, 1);
									createItemInBrowser(callback);
								});
							} else {
								browserBookmarkApi.addBookmarkToDefaultFolder(ret.parentList, itemsToBeCreated[0].get('title'), itemsToBeCreated[0].get('url'), function(err, bookmarkNode) {
									if (err) {
										return;
									}
									//console.log('bookmark added to default folder');
									itemsToBeCreated.splice(0, 1);
									createItemInBrowser(callback);
								});
							}
						} else { // is folder
							var children = that.getChildren(itemsToBeCreated[0].getId());
							itemsToBeCreated = itemsToBeCreated.concat(children);
							itemsToBeCreated.splice(0, 1);
							createItemInBrowser(callback);
						}
					} else {
						console.log('calling callback');
						console.log('type of', typeof callback);
						callback();
					}
				}

				function createItemInDataStore(callback) {
					console.log('creating item in datastore');
					if (itemsToBeCreatedInDataStore.length) {
						if (itemsToBeCreatedInDataStore[0].url) { //is bookmark ??
							browserBookmarkApi.getNodeParentList(itemsToBeCreatedInDataStore[0], function(err, node, parentList, isToolbarEntry) {
								if (err) {
									return;
								} else {
									if (isToolbarEntry) {
										that.createBookmarkEntryInToolbar(parentList, node.title, node.url);
									} else {
										that.createBookmarkEntry(parentList, node.title, node.url);
									}
									itemsToBeCreatedInDataStore.splice(0, 1);
									createItemInDataStore(callback);
								}
							});
						} else { // is folder
							browserBookmarkApi.getChildren(itemsToBeCreatedInDataStore[0].id, function(err, bmChildrenList) {
								if (err) {
									return;
								} else {
									if (bmChildrenList && bmChildrenList.length) {
										itemsToBeCreatedInDataStore = itemsToBeCreatedInDataStore.concat(bmChildrenList);
									}
									itemsToBeCreatedInDataStore.splice(0, 1);
									createItemInDataStore(callback);
								}
							});
						}
					} else {
						console.log('calling callback again');
						callback();
					}
				}

				function processEntries() {
					console.log("processing entries");
					if (lastSyncTime) {
						for (var i = 0; i < itemsToBeDeleted.length; i++) {
							var timeStamp = itemsToBeDeleted[i].dateUpdated;
							if (!timeStamp) {
								timeStamp = itemsToBeDeleted[i].dateCreated;
							}
							console.log("timestamp ==> ", timeStamp, " - ", lastSyncTime);
							if (timeStamp < lastSyncTime) {
								console.log("deleting node");
								browserBookmarkApi.removeNode(itemsToBeDeleted[i]);
							} else {
								itemsToBeCreatedInDataStore.push(itemsToBeDeleted[i]);
							}
						}
					} else {
						itemsToBeCreatedInDataStore = itemsToBeCreatedInDataStore.concat(itemsToBeDeleted);
					}

					// creating items in browser and datastore
					createItemInBrowser(function() {
						createItemInDataStore(function() {
							syncCallback();
						});
					});
				}

				function doSync(dsFolderId, bmFolderId) {

					browserBookmarkApi.getChildren(bmFolderId, function(err, bmChildrenList) {
						if (err) {
							return;
						}
						var dsChildren = that.getChildren(dsFolderId);
						if (bmChildrenList) {
                            while (dsChildren.length) {
								var i = 0;
								var found = false;
								while (bmChildrenList.length) {
									if (!dsChildren[0].get('url')) { //is folder ??
										if ((dsChildren[0].get('title') === bmChildrenList[i].title) && !bmChildrenList[i].url) { // folder name match
											foldersFound.push({
												dsFolder: dsChildren[0],
												bmFolder: bmChildrenList[i]
											});
											dsChildren.splice(0, 1);
											bmChildrenList.splice(i, 1);
											found = true;
											break;
										}
									} else {

										if ((dsChildren[0].get('title') === bmChildrenList[i].title) && (dsChildren[0].get('url') === bmChildrenList[i].url)) { // folder name match
											dsChildren.splice(0, 1);
											bmChildrenList.splice(i, 1);
											found = true;
											break;
										}
									}
									i++;
									if (i === bmChildrenList.length) {
										break;
									}
								}
								if (!found) {

									itemsToBeCreated.push(dsChildren[0]);
									dsChildren.splice(0, 1);
								}
							}
							if (bmChildrenList.length) {
								for (var i = 0; i < bmChildrenList.length; i++) {
									itemsToBeDeleted.push(bmChildrenList[i]);
								}
							}
						} else {
							if (dsChildren && dsChildren.length) {
								for (var i = 0; i < dsChildren.length; i++) {
									itemsToBeCreated.push(dsChildren[i]);
								}
							}
						}

						if (foldersFound.length) {
							var seachFolder = foldersFound[0];
							foldersFound.splice(0, 1);
							doSync(seachFolder.dsFolder.getId(), seachFolder.bmFolder.id);
						} else {
							processEntries();
						}
					});
				}


				doSync(startId, startId);

			}

			this.setBookmarkApi = function(api) {
				browserBookmarkApi = api;
			};
			this.setLastSyncTime = function(time) {
				lastSyncTime = time;
			};
			this.setLastSyncTimeUpdateFunc = function(func) {
				updateLastSyncTimeFunc = func;
			}

			this.syncBookmarks = function() {
				if (!browserBookmarkApi) {
					return;
				}
				lastSyncSuccess = false;
				sync(browserBookmarkApi, null, function() {
					sync(browserBookmarkApi, 'toolbar', function() {
						lastSyncTime = new Date().getTime();
						updateLastSyncTimeFunc(lastSyncTime);
						syncedSinceBoot = true;
						lastSyncSuccess = true;
					});
				});

			}


			this.hasSyncedSinceBoot = function() {
				return syncedSinceBoot;
			}
			this.lastSyncSuccessFull = function() {
				return lastSyncSuccess;
			}

			this.close = function() {
				//datastore.close();
				//localStorage.removeItem('lastSyncTime');
				lastSyncTime = null;
				folderTable = null;
				bookmarkTable = null;
				syncedSinceBoot = false;
			};

			this.deleteAll = function() {
				var recordsFetched = folderTable.query({});
				if (recordsFetched && recordsFetched.length) {
					recordsFetched.forEach(function(record) {
						record.deleteRecord();
					});
				}
				recordsFetched = bookmarkTable.query({});
				if (recordsFetched && recordsFetched.length) {
					recordsFetched.forEach(function(record) {
						record.deleteRecord();
					});
				}
				return true;
			}
		}
	})(window);