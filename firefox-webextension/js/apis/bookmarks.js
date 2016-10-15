(function(window) {

	function chromeBookmarkGetChildren(startNodeId, callback) {

		chrome.bookmarks.getChildren(startNodeId, function(bookmarksNodesList) {
			
			try {
				if (chrome.extension.lastError) {
					console.log('error in get', chrome.extension.lastError);
					callback(true, null);
				} else {
					if (bookmarksNodesList) {
						callback(false, bookmarksNodesList);
					} else {
						callback(false, null);
					}
				}
			} catch (err) {
				console.log('catch error in get', err);
				callback(true, null);
			}
		});
	}

	function chromeBookmarkGetNode(nodeId, callback) {
		chrome.bookmarks.get(nodeId, function(bookmarkNodeList) {
			try {
				if (chrome.extension.lastError) {
					console.log('error in create', chrome.extension.lastError);
					callback(true, null);
				} else {
					if (bookmarkNodeList && bookmarkNodeList.length) {
						callback(false, bookmarkNodeList[0]);
					} else {
						callback(false, null);
					}
				}
			} catch (err) {
				console.log('catch error in get node', err);
				callback(true, null);
			}
		});
	}

	function chromeBookmarkCreate(parentId, title, url, callback) {
		try {
			var obj = {
				'parentId': parentId,
				'title': title,
			}
			if (url) {
				obj.url = url;
			}
			chrome.bookmarks.create(obj, function(bookmarkNode) {
				if (chrome.extension.lastError) {
					console.log('error in create', chrome.extension.lastError);
					callback(true, null);
				} else {
					callback(false, bookmarkNode);
				}
			});
		} catch (err) {
			console.log('catch error in create', err);
			callback(true, null);
		}

	}

	function chromeBookmarkRemove(node, callback) {
		if (!(node && node.id)) {
			callback(true);
			return;
		}

		if (node.url) {
			chrome.bookmarks.remove(node.id, function() {
				try {
					if (chrome.extension.lastError) {
						console.log('error in delete', chrome.extension.lastError);
						callback(true, null);
					} else {
						callback(false, node);
					}
				} catch (err) {
					callback(true, null);
				}

			})
		} else {

			chrome.bookmarks.removeTree(node.id, function() {
				try {
					if (chrome.extension.lastError) {
						console.log('error in delete', chrome.extension.lastError);
						callback(true, null);
					} else {
						callback(false, node);
					}
				} catch (err) {
					callback(true, null);
				}
			});
		}

	}

	// handling events 

	var eventsListeners = {};

	//onCreate
	chrome.bookmarks.onCreated.addListener(function(bookmarkId, bookmarkNode) {
		if (typeof eventsListeners.onCreate === 'function') {
			eventsListeners.onCreate(bookmarkId, bookmarkNode);
		}
	});

	chrome.bookmarks.onChanged.addListener(function(bookmarkId, changeInfo) {
		if (typeof eventsListeners.onUpdate === 'function') {
			eventsListeners.onUpdate(bookmarkId, changeInfo);
		}
	});
	chrome.bookmarks.onMoved.addListener(function(bookmarkId, moveInfo) {
		if (typeof eventsListeners.onMove === 'function') {
			eventsListeners.onMove(bookmarkId, moveInfo);
		}
	});
	chrome.bookmarks.onRemoved.addListener(function(bookmarkId, removeInfo) {
		if (typeof eventsListeners.onRemove === 'function') {
			eventsListeners.onRemove(bookmarkId, removeInfo);
		}
	});

	function setChromeEventListener(eventName, eventHandler) {
		eventsListeners[eventName] = eventHandler;
	}

	function removeChromeAllEventListeners() {
		eventsListeners = {};
	}



	var chromeBookmarkInstance = null;

	window.ChromeBookmarkManager = {
		getManagerInstance: function(callback) {
			if (chromeBookmarkInstance) {
				callback(null, chromeBookmarkInstance);
			} else {
				var sequencer = new Sequencer();
				var instance = new ChromeBookmarksApi(sequencer, function(err, inst) {
					if (err) {
						callback(err, null);
					} else {
						chromeBookmarkInstance = instance;
						callback(null, instance);
					}
				});
			}
		}
	};

	var ChromeBookmarksApi = function(sequencer, constructorCallback) {

		var bookmarktoolBarFolderName = 'Bookmarks Bar'
		var defaultBookmarkfolderName = 'Other Bookmarks'

		var defaults = {
			onCreate: null,
			onMove: null,
			onRemove: null,
			onUpdate: null
		};
		var events = null;

		var that = this;
		if (!events) {
			events = defaults;
		}



		function loopBookmarkNodes(rootId, callback) {
			var startNodeId;
			if (!rootId) {
				startNodeId = "0";
			} else {
				startNodeId = rootId;
			}
			chromeBookmarkGetChildren(startNodeId, callback);
		}


		var findParentFolderFromParentList = function(parentList, createParent, callback) {
			var lastFoundParentId = null;
			var createBookmarkFolder = function() {
				if (parentList && parentList.length) {
					chromeBookmarkCreate(lastFoundParentId, parentList[0], null, function(error, bookmarkNode) {
						if (error) {
							callback(true, null);
							return;
						}

						lastFoundParentId = bookmarkNode.id;
						parentList.splice(0, 1);
						if (parentList.length == 0) {
							callback(false, bookmarkNode);
						} else {
							createBookmarkFolder();
						}
					});
				} else {
					callback(false, null);
				}
			}



			var search = function(err, bookmarkNodeList) {
				if (err) {
					callback(true, null);
					return;
				}
				if (bookmarkNodeList) {

					for (var i = 0; i < bookmarkNodeList.length; i++) {
						var bookmarkNode = bookmarkNodeList[i];
						if ((bookmarkNode.title === parentList[0]) && !bookmarkNode.url) { //grand parent found

							lastFoundParentId = bookmarkNode.id; //saving last found parent id;
							parentList.splice(0, 1);
							if (parentList.length === 0) { //parent found ??
								callback(false, bookmarkNode);
								return;
							} else { // has more parents
								loopBookmarkNodes(bookmarkNode.id, search);
								return;
							}
						}
					}
					if (createParent) { // creating parent folders
						createBookmarkFolder();
					} else {
						callback(false, null);
					}
				} else {
					if (createParent) { // creating parent folders
						createBookmarkFolder();
					} else {
						callback(false, null);
					}
				}

			}

			loopBookmarkNodes(null, search);
		};

		var findBookmarkNodeInFolder = function(parentId, title, url, callback) {

			loopBookmarkNodes(parentId, function(error, bookmarkNodeList) {
				if (error) {
					callback(true, null);
					return;
				}
				if (bookmarkNodeList) {
					// checking for bookmark
					var bookmarkNodeFound = null
					for (var i = 0; i < bookmarkNodeList.length; i++) {
						var bookmarkNode = bookmarkNodeList[i];

						if (url) {
							if ((bookmarkNode.title === title) && bookmarkNode.url === url) {
								bookmarkNodeFound = bookmarkNode;
								break;
							}
						} else {
							if (bookmarkNode.title === title) {
								bookmarkNodeFound = bookmarkNode;
								break;
							}
						}
					}
					callback(false, bookmarkNodeFound);
				} else {
					callback(false, null);
				}
			});
		}


		var addBookmark = function(parentList, title, url, callback) {
			if (parentList && parentList.length) {
				// creating a sequence of functions for this operation
				sequencer.addFunction(function(next) {
					findParentFolderFromParentList(parentList, true, function(err, parentFolderNode) {
						//console.log('in here');
						if (err) {
							next();
						} else {
							findBookmarkNodeInFolder(parentFolderNode.id, title, url, function(err, bookmarkNode) {
								if (err) {
									next();
								} else {
									if (!bookmarkNode) {
										chromeBookmarkCreate(parentFolderNode.id, title, url, function(err, bookmarkNode) {
											if (err) {
												console.log('err ==>');
												callback(true,null);
												next();
											} else {
												//console.log('created');
												callback(false, bookmarkNode);
												next();
											}
										});
									} else {
										callback(false, bookmarkNode);
										next();
									}
								}
							});
						}
					});
				});
			}
		};

		this.addBookmarkToToolbar = function(parentList, title, url, callback) {
			if (!(parentList && parentList.length)) {
				parentList = [];
			}
			parentList.splice(0, 0, bookmarktoolBarFolderName);
			addBookmark(parentList, title, url, callback);
		}

		this.addBookmarkToDefaultFolder = function(parentList, title, url, callback) {
			if (!(parentList && parentList.length)) {
				parentList = [];
			}
			parentList.splice(0, 0, defaultBookmarkfolderName);
			addBookmark(parentList, title, url, callback);
		}

		var createBookmarkFolderNode = function(parentList, title, callback) {
			if (parentList && parentList.length) {
				//trying to find parent id for this bookmark
				sequencer.addFunction(function(next) {
					findParentFolderFromParentList(parentList, true, function(err, parentFolderNode) {
						if (err) {
							next();
						} else {
							callback(false, parentFolderNode);
							next();
						}
					});
				});

			} else {
				callback(null, "Invalid Parameters");
			}
		};

		this.createFolderInToolbar = function(parentList, title, callback) {
			if (!(parentList && parentList.length)) {
				parentList = [];
			}
			parentList.splice(0, 0, bookmarktoolBarFolderName);
			createBookmarkFolderNode(parentList, title, callback);
		}

		this.createFolder = function(parentList, title, callback) {
			if (!(parentList && parentList.length)) {
				parentList = [];
			}
			parentList.splice(0, 0, defaultBookmarkfolderName);
			createBookmarkFolderNode(parentList, title, callback);
		}

		var findBookmarkNodeParentList = function(bookmarkNode, callback) { // need to optimize later
			var parentList = [];

			function getCallback(err, node) {
				if (err) {
					callback(true, null, null);
					return;
				} else {
					if (node && node.parentId) {
						parentList.push(node.title);
						chromeBookmarkGetNode(node.parentId, getCallback);
					} else { // parent root node 
						parentList.reverse();
						callback(false, bookmarkNode, parentList);
					}
				}
			}
			chromeBookmarkGetNode(bookmarkNode.parentId, getCallback);
		}


			function isToolbarEntry(parentList) {
				var isToolbarEntry = false;
				if (parentList && parentList.length) {
					if (parentList[0] === bookmarktoolBarFolderName) {
						isToolbarEntry = true;
					} else {
						isToolbarEntry = false;
					}
					parentList.splice(0, 1);
				}
				return isToolbarEntry;
			}

		this.getNodeParentList = function(bookmarkNode, callback) {
			findBookmarkNodeParentList(bookmarkNode, function(err, bookmarkNode, parentList) {
				if (err) {
					callback(true, null, null);
				} else {
					var toolbarEntry = isToolbarEntry(parentList);
					callback(false, bookmarkNode, parentList, toolbarEntry);
				}

			});
		}

		this.getChildren = function(nodeId, callback) {

			function getChildrenList(id) {
				loopBookmarkNodes(id, function(err, nodeList) {
					callback(err, nodeList);
				});
			}

			if (!nodeId || nodeId === 'toolbar') {
				loopBookmarkNodes(null, function(err, nodeList) {
					if (err) {
						callback(true, null);
						return;
					}
					var startId = null;
					var title = bookmarktoolBarFolderName;
					if (!nodeId) {
						title = defaultBookmarkfolderName;
					}
					for (var i = 0; i < nodeList.length; i++) {
						if (nodeList[i].title == title) {
							startId = nodeList[i].id;
							break;
						}

					}
					if (startId) {
						getChildrenList(startId);
					}


				});
			} else {
				getChildrenList(nodeId);
			}


		};

		this.loopAllBookmarks = function(callback) { // need to optimize later
			var bookmarkNodeList = [];
			var bookmarkFolderList = [];

			var findParentList = function() {
				for (var i = 0; i < bookmarkNodeList.length; i++) {
					findBookmarkNodeParentList(bookmarkNodeList[i], function(err, bookmarkNode, parentList) {
						if (err) {
							callback(true, null, null, null);
							return;
						}
						var toolbarEntry = isToolbarEntry(parentList);
						callback(false, bookmarkNode, parentList, toolbarEntry);

					});
				}
			}

			var loopCallback = function(err, bookmarkNodes) {
				if (err) {
					callback(true, null);
					return;
				}

				if (bookmarkNodes) {
					for (var i = 0; i < bookmarkNodes.length; i++) {
						var bookmarkNode = bookmarkNodes[i];
						if (bookmarkNode.url) { //is bookmark item ??
							bookmarkNodeList.push(bookmarkNode);
						} else {
							bookmarkFolderList.push(bookmarkNode);
						}
					}
				}

				if (bookmarkFolderList.length) { // more folders remaining
					var bookmarkFolderNode = bookmarkFolderList[0];
					bookmarkFolderList.splice(0, 1);
					loopBookmarkNodes(bookmarkFolderNode.id, loopCallback);
				} else {
					findParentList();
				}

			};
			loopBookmarkNodes(null, loopCallback);

		}

		this.removeNode = function(node, callback) {
			sequencer.addFunction(function(next) {
				chromeBookmarkRemove(node, function(err) {
					if (typeof callback === 'function') {
						callback(err);
					}
					next();
				});
			});
		}


		this.setEventsListener = function(eventsObj) {
			if (eventsObj) {
				events = eventsObj;
			}
		}


		this.close = function() {
			removeChromeAllEventListeners();
			chromeBookmarkInstance = null;
		};

		//setting Event Listeners

		//onCreate
		setChromeEventListener('onCreate', function(bookmarkId, bookmarkNode) {
			if (typeof events.onCreate === 'function') {
				findBookmarkNodeParentList(bookmarkNode, function(err, bookmarkNode, parentList) {
					if (!err) {
						var toolbarEntry = isToolbarEntry(parentList);
						events.onCreate(parentList, bookmarkNode, toolbarEntry);
					}
				});
			}
		});

		//onUpdate
		setChromeEventListener('onUpdate', function(bookmarkId, changeInfo) {
			if (typeof events.onUpdate === 'function') {
				chromeBookmarkGetNode(bookmarkId, function(err, node) {
					if (err) {
						return;
					}
					if (!node) {
						return;
					}

					var siblingFolders = [];
					var siblingBookmarks = [];
					loopBookmarkNodes(node.parentId, function(err, bookmarkNodeListChildren) {
						if (err) {
							return;
						}
						if (!(bookmarkNodeListChildren && bookmarkNodeListChildren.length)) {
							return;
						}


						for (var i = 0; i < bookmarkNodeListChildren.length; i++) {
							if (bookmarkNodeListChildren[i].id != bookmarkId) { // not the same node
								if (bookmarkNodeListChildren[i].url) {
									siblingBookmarks.push({
										url: bookmarkNodeListChildren[i].url,
										title: bookmarkNodeListChildren[i].title
									});
								} else {
									siblingFolders.push(bookmarkNodeListChildren[i].title);
								}
							}
						}

						findBookmarkNodeParentList(node, function(err, bookmarkNode, parentList) {
							if (err) {
								return;
							}
							var toolbarEntry = isToolbarEntry(parentList);

							var isBookmark = false;
							if (bookmarkNode.url) { // is bookmark ??
								isBookmark = true;
							}

							events.onUpdate(parentList, bookmarkNode, siblingFolders, siblingBookmarks, isBookmark, toolbarEntry);
						});
					});

				});
			}

		});

		//onRemove

		setChromeEventListener('onRemove', function(bookmarkId, removeInfo) {
			if (typeof events.onRemove === 'function') {

				chromeBookmarkGetNode(removeInfo.parentId, function(err, node) {
					if (err) {
						return;
					}
					if (!node) {
						return;
					}

					loopBookmarkNodes(node.id, function(err, bookmarkNodeListChildren) {
						if (err) {
							return;
						}

						findBookmarkNodeParentList(node, function(err, bookmarkNode, parentList) {
							if (err) {
								return;
							}
							if (!(parentList && parentList.length)) {
								parentList = [];
							}
							parentList.push(bookmarkNode.title);
							var toolbarEntry = isToolbarEntry(parentList);
							events.onRemove(bookmarkNode, parentList, bookmarkNodeListChildren, toolbarEntry);
						});

					});

				});
			}
		});

		//onMoved 

		setChromeEventListener('onMove', function(bookmarkId, moveInfo) {
			if (typeof events.onMove === 'function') {
				var isBookmark = true;
				chromeBookmarkGetNode(bookmarkId, function(err, node) {
					if (err) {
						return;
					}

					if (!node.url) {
						isBookmark = false;
					}
					//finding new parentList
					findBookmarkNodeParentList(node, function(err, bookmarkNode, newParentList) {
						//finding old parentList 
						if (err) {
							return;
						}
						chromeBookmarkGetNode(moveInfo.oldParentId, function(err, parentNode) {
							if (err) {
								return;
							}
							findBookmarkNodeParentList(parentNode, function(err, bookmarkNode, oldParentList) {
								if (err) {
									return;
								}
								if (!(oldParentList && oldParentList.length)) {
									oldParentList = [];
								}
								oldParentList.push(bookmarkNode.title);

								var isNewEntryToolbarEntry = isToolbarEntry(newParentList);

								var isOldEntryToolbarEntry = isToolbarEntry(oldParentList);

								events.onMove(node, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry, isBookmark);
							});
						});
					});
				});
			}
		});

		// calling contructor callback;
		loopBookmarkNodes(null, function(err, nodes) {
			if (err) {
				constructorCallback(true, null);
			} else {
				if (nodes[0].title.toUpperCase() === bookmarktoolBarFolderName.toUpperCase()) {
					bookmarktoolBarFolderName = nodes[0].title;
					defaultBookmarkfolderName = nodes[1].title;
				} else {
					bookmarktoolBarFolderName = nodes[1].title;
					defaultBookmarkfolderName = nodes[0].title;
				}
				console.log(bookmarktoolBarFolderName, ' -- ', defaultBookmarkfolderName);
				constructorCallback(null, that);
			}
		});

	}

})(window);