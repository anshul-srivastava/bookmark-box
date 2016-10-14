var {
    Cc, Ci
} = require("chrome");
var firefoxBookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
    .getService(Ci.nsINavBookmarksService);

var firfoxHistoryService = Cc["@mozilla.org/browser/nav-history-service;1"]
    .getService(Ci.nsINavHistoryService);

var firefoxBookmarkURIService = Cc["@mozilla.org/network/io-service;1"]
    .getService(Ci.nsIIOService);


var TYPE_BOOKMARK = 1;
var TYPE_FOLDER = 2;
var TYPE_SEPERATOR = 3;
var TYPE_DYNAMIC_CONTAINER = 4;

var ROOT_FOLDER_ID = firefoxBookmarksService.placesRoot;
var TOOLBAR_FOLDER_ID = firefoxBookmarksService.toolbarFolder;
var BOOKMARK_MENU_FOLDER_ID = firefoxBookmarksService.bookmarksMenuFolder;
var UNSORTED_BOOKMARK_FOLDER_ID = firefoxBookmarksService.unfiledBookmarksFolder;
var TAGS_FOLDER_ID = firefoxBookmarksService.tagsFolder;

var UNSORTED_BOOKMARKS_FOLDER_NAME = 'Firefox Unsorted Bookmarks';


function firefoxBookmarkServiceGetNodeType(nodeId) {
    var type = firefoxBookmarksService.getItemType(nodeId)
    if (type === firefoxBookmarksService.TYPE_BOOKMARK) {
        return TYPE_BOOKMARK;
    } else if (type === firefoxBookmarksService.TYPE_FOLDER) {
        return TYPE_FOLDER;
    } else if (type === firefoxBookmarksService.TYPE_DYNAMIC_CONTAINER) {
        return TYPE_DYNAMIC_CONTAINER;
    } else {
        return TYPE_SEPERATOR;
    }
}


function firefoxBookmarkServiceGenerateURl(url) {
    var URL = null;
    try {
        var URL = firefoxBookmarkURIService.newURI(url, null, null);
    } catch (err) {
        URL = null;
    }
    return URL;
}

function firefoxBookmarkServiceGetChildren(startNodeId) {
    var folderNode = null;
    try {
        var query = firfoxHistoryService.getNewQuery();
        query.setFolders([startNodeId], 1);
        var result = firfoxHistoryService.executeQuery(query, firfoxHistoryService.getNewQueryOptions());
        // The root property of a query result is an object representing the folder you specified above.
        folderNode = result.root;
        // Open the folder, and iterate over its contents.
        folderNode.containerOpen = true;
    } catch (err) {
        console.log("err in get children", err);
        folderNode = null;
    }
    return folderNode
}

function firefoxBookmarkServiceGetNode(nodeId) {
    var node = {};
    try {
        node.id = nodeId;
        if (node.id === UNSORTED_BOOKMARK_FOLDER_ID) {
            node.title = UNSORTED_BOOKMARKS_FOLDER_NAME;
        } else {
            node.title = firefoxBookmarksService.getItemTitle(nodeId);
        }
        node.parentId = firefoxBookmarksService.getFolderIdForItem(nodeId);
        node.dateCreated = firefoxBookmarksService.getItemDateAdded(nodeId) / 1000;
        node.dateUpdated = firefoxBookmarksService.getItemLastModified(nodeId) / 1000;
        if (firefoxBookmarkServiceGetNodeType(nodeId) === TYPE_BOOKMARK) {
            node.url = firefoxBookmarksService.getBookmarkURI(nodeId).spec;
        }
        node.type = firefoxBookmarksService.getItemType(nodeId);
    } catch (err) {
        console.log(nodeId, err);
        node = null;
    }
    return node;
}

function firefoxBookmarkServiceCreate(parentId, title, url) {
    var nodeId;
    var node = null;
    try {
        if (url) {
            var bookmarkURL = firefoxBookmarkServiceGenerateURl(url);
            if (bookmarkURL) {
                nodeId = firefoxBookmarksService.insertBookmark(
                    parentId, // The id of the folder the bookmark will be placed in.
                    bookmarkURL, // The URI of the bookmark - an nsIURI object.
                    firefoxBookmarksService.DEFAULT_INDEX, // The position of the bookmark in its parent folder.
                    title // The title of the bookmark.
                );
            } else { // hack for invalid URI
                node = {};
                node.err = true;
                node.errMsg = "unable to create URI Object";
            }
        } else {
            nodeId = firefoxBookmarksService.createFolder(
                parentId, // The id of the folder the new folder will be placed in.
                title, // The title of the new folder.
                firefoxBookmarksService.DEFAULT_INDEX
            );
        }
        if (nodeId) {
            node = firefoxBookmarkServiceGetNode(nodeId);
        }
    } catch (error) {
        node = null;
    }
    return node;

}

function firefoxBookmarkServicesRemove(nodeId) {
    console.log('removing node id ==>', nodeId);
    if (nodeId === UNSORTED_BOOKMARK_FOLDER_ID) {
        firefoxBookmarksService.removeFolderChildren(nodeId)
    } else {
        firefoxBookmarksService.removeItem(nodeId);
    }
}



var firefoxBookmarkInstance = null;

exports.getInstance = function() {
    if (firefoxBookmarkInstance) {
        return firefoxBookmarkInstance;
    } else {
        var instance = new FirefoxBookmarksApi();
        firefoxBookmarkInstance = instance;
        return instance;
    }
};


var FirefoxBookmarksApi = function() {

    var bookmarktoolBarFolderName = 'Bookmarks Bar'
    var defaultBookmarkfolderName = 'Other Bookmarks'


    var that = this;



    var findParentFolderFromParentList = function(startNodeId, parentList, createParent) {
        if (!(parentList && parentList.length)) {
            return false;
        }
        var folderNode = firefoxBookmarkServiceGetChildren(startNodeId);
        if (!folderNode) {
            return null;
        }
        var lastFoundChildNode = null;
        var i = 0;
        while (i < folderNode.childCount) {
            var childNode = folderNode.getChild(i);
            if (firefoxBookmarkServiceGetNodeType(childNode.itemId) === TYPE_FOLDER) {
                if (childNode.title === parentList[0]) {
                    childNode = firefoxBookmarkServiceGetNode(childNode.itemId);
                    lastFoundChildNode = childNode;
                    parentList.splice(0, 1);
                    if (parentList.length === 0) { //parent Node found !!
                        return childNode;
                    } else {
                        folderNode = firefoxBookmarkServiceGetChildren(childNode.id);
                        if (!folderNode) {
                            return null;
                        }
                        i = -1;
                    }
                }
            }

            i++;
        }
        // not found creating folders
        if (createParent && parentList.length) {
            var startId = startNodeId;
            if (lastFoundChildNode) {
                startId = lastFoundChildNode.id;
            }
            for (i = 0; i < parentList.length; i++) {
                var createdNode = firefoxBookmarkServiceCreate(startId, parentList[i], null);
                if (!createdNode) {
                    console.log('created Node is null');
                    return null;
                }
                startId = createdNode.id;
            }
            return createdNode;
        } else {
            return null;
        }



    };

    var findBookmarkNodeInFolder = function(parentId, title, url) {
        var folderNode = firefoxBookmarkServiceGetChildren(parentId);
        if (!folderNode) {
            return null;
        }
        for (var i = 0; i < folderNode.childCount; i++) {
            var childNode = folderNode.getChild(i);
            if (firefoxBookmarkServiceGetNodeType(childNode.itemId) === TYPE_BOOKMARK) {
                var node = firefoxBookmarkServiceGetNode(childNode.itemId);
                if (!node) {
                    return null;
                }
                if (node.title === title && node.url === url) {
                    return node;
                }
            }
        }

        return false;
    }

    var findBookmarkNodeParentsData = function(bookmarkNode) {
            var parentsData = {};
            var parentList = [];
            var parentId = bookmarkNode.parentId;
            if (bookmarkNode.id === TAGS_FOLDER_ID) {
                return null;
            }


            if (parentId != ROOT_FOLDER_ID) {
                while (parentId) {
                    var parentNode = firefoxBookmarkServiceGetNode(parentId);
                    if (parentNode.parentId != ROOT_FOLDER_ID) {

                        parentList.push(parentNode.title);
                        parentId = parentNode.parentId;
                    } else {
                        parentList.push(parentNode.title);
                        break;
                    }
                }
            } else {
                parentId = bookmarkNode.id;
                parentList.push(bookmarkNode.title);
            }
            parentsData.parentList = parentList.reverse();
            parentsData.lastParentId = parentId;



            if (parentsData.lastParentId !== TAGS_FOLDER_ID) {
                parentsData.toolbarEntry = false;
                if (parentsData.lastParentId === TOOLBAR_FOLDER_ID) {
                    parentsData.parentList.splice(0, 1);
                    parentsData.toolbarEntry = true;
                } else if (parentsData.lastParentId === BOOKMARK_MENU_FOLDER_ID) {
                    parentsData.parentList.splice(0, 1);
                    parentsData.toolbarEntry = false;
                } else if (parentsData.lastParentId === UNSORTED_BOOKMARK_FOLDER_ID) {
                    parentsData.parentList[0] = UNSORTED_BOOKMARKS_FOLDER_NAME;
                    parentsData.toolbarEntry = false;
                }
                return parentsData;

            } else {
                return null;
            }


        }
        // Returns array of children where each item is a object minus functions 
    var getFormatedChildren = function(nodeId) {
        var folderNode = firefoxBookmarkServiceGetChildren(nodeId);
        if (!folderNode) {
            return null;
        }
        var childrenList = [];
        for (var i = 0; i < folderNode.childCount; i++) {
            var childNode = folderNode.getChild(i);
            var nodeType = firefoxBookmarkServiceGetNodeType(childNode.itemId);
            if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {
                var node = firefoxBookmarkServiceGetNode(childNode.itemId);
                if (!node) {
                    return null;
                }
                if (node.url) {
                    var index = node.url.indexOf('place:');
                    if (index !== 0) {
                        childrenList.push(node);
                    }
                } else {
                    childrenList.push(node);
                }



            }
        }
        return childrenList;
    };


    var addBookmark = function(startNodeId, parentList, title, url) {
        var parentId = startNodeId;
        if (parentList && parentList.length) {
            // creating a sequence of functions for this operation

            var parentNode = findParentFolderFromParentList(startNodeId, parentList, true);
            if (!parentNode) {
                return false;
            }
            parentId = parentNode.id;
        }

        var bookmarkNode = findBookmarkNodeInFolder(parentId, title, url);
        if (bookmarkNode === null) {
            return null;
        }
        if (!bookmarkNode) { // Bookmark node does not exist
            bookmarkNode = firefoxBookmarkServiceCreate(parentId, title, url);
        }

        return bookmarkNode;

    };

    this.addBookmarkToToolbar = function(parentList, title, url) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        return addBookmark(TOOLBAR_FOLDER_ID, parentList, title, url);
    }

    this.addBookmarkToUnsortedFolder = function(parentList, title, url) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        return addBookmark(UNSORTED_BOOKMARK_FOLDER_ID, parentList, title, url);
    }

    this.addBookmarkToDefaultFolder = function(parentList, title, url) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        if (parentList[0] === UNSORTED_BOOKMARKS_FOLDER_NAME) {
            parentList.splice(0, 1);
            return this.addBookmarkToUnsortedFolder(parentList, title, url);
        } else {
            return addBookmark(BOOKMARK_MENU_FOLDER_ID, parentList, title, url);
        }
    }



    this.createFolderInToolbar = function(parentList, title) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        parentList.push(title);
        var parentNode = findParentFolderFromParentList(TOOLBAR_FOLDER_ID, parentList, true);
        return parentNode;
    }

    this.createFolderInDefaultFolder = function(parentList, title) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        parentList.push(title);
        var parentNode = findParentFolderFromParentList(BOOKMARK_MENU_FOLDER_ID, parentList, true);
        return parentNode;
    }

    this.createFolderInUnsortedFolder = function(parentList, title) {
        if (!(parentList && parentList.length)) {
            parentList = [];
        }
        parentList.push(title);
        var parentNode = findParentFolderFromParentList(UNSORTED_BOOKMARK_FOLDER_ID, parentList, true);
        return parentNode;
    }

    this.getChildren = function(nodeId) {
        var startId = null;
        if (!nodeId) {
            startId = BOOKMARK_MENU_FOLDER_ID;
        } else if (nodeId === 'toolbar') {
            startId = TOOLBAR_FOLDER_ID;
        } else {
            startId = nodeId
        }

        var childrenList = [];

        var folderNode = firefoxBookmarkServiceGetChildren(startId);
        if (folderNode) {
            for (var i = 0; i < folderNode.childCount; i++) {
                var childNode = folderNode.getChild(i);
                var nodeType = firefoxBookmarkServiceGetNodeType(childNode.itemId);
                if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {

                    var node = firefoxBookmarkServiceGetNode(childNode.itemId);

                    if (node.url) {
                        var index = node.url.indexOf('place:');
                        if (index !== 0) {
                            childrenList.push(node);
                        }
                    } else {
                        childrenList.push(node);
                    }
                }
            }

            if (!nodeId) {
                var node = firefoxBookmarkServiceGetNode(UNSORTED_BOOKMARK_FOLDER_ID);
                childrenList.push(node);
            }
            return childrenList;
        } else {
            return null;
        }
    };

    this.getNodeParentsData = function(node) {
        if (node && node.id && node.parentId) {
            var parentsData = findBookmarkNodeParentsData(node);
            if (parentsData) {
                return parentsData;
            } else {
                return null;
            }
        } else {
            return null;
        }

    }

    this.loopAllBookmarks = function(callback) { // need to optimize later

    }

    this.removeNode = function(node) {
        firefoxBookmarkServicesRemove(node.id);
    }


    this.setEventsListener = function(eventsObj) {
        if (eventsObj) {
            eventsListeners = eventsObj;
        }
    }


    this.close = function() {
        //removeChromeAllEventListeners();\
        eventsListeners = null;
        firefoxBookmarkInstance = null;
        firefoxBookmarksService.removeObserver(observer);
    };


    var eventsListeners = {};

    var observer = {

        onItemAdded: function(id, folder, index) {
            if (typeof eventsListeners.onCreate === 'function') {
                var nodeType = firefoxBookmarkServiceGetNodeType(id);
                if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {
                    var bookmarkNode = firefoxBookmarkServiceGetNode(id);
                    if (bookmarkNode.url) {
                        var index = bookmarkNode.url.indexOf('place:');
                        if (index !== 0) {
                            var parentsData = findBookmarkNodeParentsData(bookmarkNode);
                            if (parentsData) {
                                eventsListeners.onCreate(parentsData.parentList, bookmarkNode, parentsData.toolbarEntry);
                            }
                        }
                    } else {
                        var parentsData = findBookmarkNodeParentsData(bookmarkNode);
                        if (parentsData) {
                            eventsListeners.onCreate(parentsData.parentList, bookmarkNode, parentsData.toolbarEntry);
                        }
                    }

                }
            }
        },
        onItemRemoved: function(id, folderId, index) {
            if (typeof eventsListeners.onRemove === 'function') {

                var parentNode = firefoxBookmarkServiceGetNode(folderId);

                if (parentNode) {
                    var parentsData = findBookmarkNodeParentsData(parentNode);
                    if (parentsData) {
                        if (parentsData.lastParentId !== parentNode.id) {
                            parentsData.parentList.push(parentNode.title);
                        }
                        //getting childrens
                        var children = getFormatedChildren(folderId);
                        if (!children) {
                            return;
                        }
                        if (folderId === BOOKMARK_MENU_FOLDER_ID) {
                            var node = firefoxBookmarkServiceGetNode(UNSORTED_BOOKMARK_FOLDER_ID);
                            children.push(node);
                        }
                        eventsListeners.onRemove(parentNode, parentsData.parentList, children, parentsData.toolbarEntry);
                    }

                }
            }


        },
        onItemChanged: function(id, property, isAnnotationProperty, value) {
            if (property === 'tags') {
                return;
            }
            // isAnnotationProperty is a boolean value that is true of the changed property is an annotation.
            // You can access a bookmark item's annotations with the <code>nsIAnnotationService</code>.
            if (typeof eventsListeners.onUpdate === 'function') {
                if (!isAnnotationProperty) {
                    var nodeType = firefoxBookmarkServiceGetNodeType(id);
                    if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {
                        var bookmarkNode = firefoxBookmarkServiceGetNode(id);

                        if (bookmarkNode.url) {
                            var index = bookmarkNode.url.indexOf('place:');
                            if (index === 0) {
                                return;
                            }
                        }


                        var parentsData = findBookmarkNodeParentsData(bookmarkNode);
                        if (parentsData) {

                            var siblingFolders = [];
                            var siblingBookmarks = [];

                            var parentNode = firefoxBookmarkServiceGetChildren(bookmarkNode.parentId);
                            if (!parentNode) {
                                return null;
                            }
                            for (var i = 0; i < parentNode.childCount; i++) {
                                var childNode = parentNode.getChild(i);

                                var nodeType = firefoxBookmarkServiceGetNodeType(childNode.itemId);
                                if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {
                                    var node = firefoxBookmarkServiceGetNode(childNode.itemId);
                                    if (node.id != bookmarkNode.id) { // not the same node
                                        if (node.url) {
                                            var index = node.url.indexOf('place:');
                                            if (index !== 0) {
                                                siblingBookmarks.push({
                                                    url: node.url,
                                                    title: node.title
                                                });
                                            }
                                        } else {
                                            siblingFolders.push(node.title);
                                        }
                                    }
                                }
                            }
                            if (bookmarkNode.parentId === BOOKMARK_MENU_FOLDER_ID) {
                                var node = firefoxBookmarkServiceGetNode(UNSORTED_BOOKMARK_FOLDER_ID);
                                siblingFolders.push(node);
                            }
                            var isBookmark = false;
                            if (bookmarkNode.url) { // is bookmark ??
                                isBookmark = true;
                            }
                            eventsListeners.onUpdate(parentsData.parentList, bookmarkNode, siblingFolders, siblingBookmarks, isBookmark, parentsData.toolbarEntry);
                        }
                    }
                }
            }

        },
        onItemMoved: function(id, oldParent, oldIndex, newParent, newIndex) {
            if (typeof eventsListeners.onMove === 'function') {
                if (oldParent !== newParent) {
                    var nodeType = firefoxBookmarkServiceGetNodeType(id);
                    if (nodeType != TYPE_SEPERATOR && nodeType != TYPE_DYNAMIC_CONTAINER) {
                        var bookmarkNode = firefoxBookmarkServiceGetNode(id);
                        var isBookmark = false;
                        if (bookmarkNode.url) { // is bookmark ??
                            isBookmark = true;
                            var index = bookmarkNode.url.indexOf('place:');
                            if (index === 0) {
                                return;
                            }
                        }

                        var newParentsData = findBookmarkNodeParentsData(bookmarkNode);
                        if (!newParentsData) {
                            return;
                        }


                        var oldParentNode = firefoxBookmarkServiceGetNode(oldParent);
                        if (!oldParentNode) {
                            return;
                        }
                        var oldParentsData = findBookmarkNodeParentsData(oldParentNode);
                        if (!oldParentsData) {
                            return;
                        }


                        if (oldParentsData.lastParentId !== oldParentNode.id) {
                            oldParentsData.parentList.push(oldParentNode.title);
                        }


                        eventsListeners.onMove(bookmarkNode, newParentsData.parentList, newParentsData.toolbarEntry, oldParentsData.parentList, oldParentsData.toolbarEntry, isBookmark);

                    }
                }


            }
        },
        /*QueryInterface: function(iid) {
			if (iid.equals(Ci.nsINavBookmarkObserver) ||
				iid.equals(Ci.nsISupports)) {
				return this;
			}
			throw Cr.NS_ERROR_NO_INTERFACE;
		},*/
    };

    firefoxBookmarksService.addObserver(observer, false);

}