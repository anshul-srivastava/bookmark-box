var datastoreManager = new DatastoreManager({
    appKey: 'xlwyafffvnbpiez',
    redirectUrl: 'https://anshul-srivastava.github.io/bookmark-box/bookmark-box-oauth-files/oauthreceiver.html'
});



var bookmarkDatastore = null;

var chromeBookmarkManager = null;


function setBrowserEventListener(chromeBookmarkManager) {
    chromeBookmarkManager.setEventsListener({
        onCreate: function(parentList, bookmarkNode, isToolbarEntry) {
            console.log('on create called');
            if (!bookmarkDatastore) {
                return;
            }
            if (bookmarkNode.url) {
                if (isToolbarEntry) {
                    var record = bookmarkDatastore.createBookmarkEntryInToolbar(parentList, bookmarkNode.title, bookmarkNode.url);
                } else {
                    var record = bookmarkDatastore.createBookmarkEntry(parentList, bookmarkNode.title, bookmarkNode.url);
                }
            } else {
                if (isToolbarEntry) {
                    bookmarkDatastore.createFolderEntryInToolbar(parentList, bookmarkNode.title);
                } else {
                    bookmarkDatastore.createFolderEntry(parentList, bookmarkNode.title);
                }
            }
            bookmarkDatastore.commit();
        },
        onUpdate: function(parentList, bookmarkNode, siblingFolders, siblingBookmarks, isBookmark, isToolbarEntry) {
            console.log("on update called");
            if (!bookmarkDatastore) {
                return;
            }
            var parentRecordId = null;
            if (isToolbarEntry) {
                parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlistForToolbar(parentList);
            } else {
                parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlist(parentList);
            }
            if (parentRecordId) {
                var childrenRecords;
                var siblings;
                if (isBookmark) {
                    childrenRecords = bookmarkDatastore.getChildrenBookmarks(parentRecordId);
                    siblings = siblingBookmarks;
                } else {
                    childrenRecords = bookmarkDatastore.getChildrenFolders(parentRecordId);
                    siblings = siblingFolders;
                }
                for (var i = 0; i < siblings.length; i++) {
                    var siblingFound = false;
                    for (var j = 0; j < childrenRecords.length; j++) {
                        if (isBookmark) {
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
                    if (isBookmark) {
                        bookmarkDatastore.updateBookmarkEntry(childrenRecords[0], bookmarkNode.title, bookmarkNode.url);
                    } else {
                        bookmarkDatastore.updateFolderEntry(childrenRecords[0], bookmarkNode.title);
                    }
                }
            }
            bookmarkDatastore.commit();

        },
        onRemove: function(parentNode, parentList, siblings, isToolbarEntry) {
            console.log('on remove called');
            if (!bookmarkDatastore) {
                return;
            }

            if (!bookmarkDatastore.lastSyncSuccessFull()) {
                console.log('not synced returning');
                return;
            }
            var parentRecordId = null;
            if (isToolbarEntry) {
                parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlistForToolbar(parentList);
            } else {
                parentRecordId = bookmarkDatastore.getParentRecordIdFromParentlist(parentList);
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
                    for (var j = 0; j < siblings.length; j++) {
                        if (isBookmark) { // is bookmark
                            if (childrenRecords[i].get('title') === siblings[j].title && childrenRecords[i].get('url') === siblings[j].url) {
                                found = true;
                                break;
                            }
                        } else {
                            if (childrenRecords[i].get('title') === siblings[j].title) {
                                found = true;
                                break;
                            }
                        }

                    }
                    if (!found) {
                        console.log('found node');
                        if (isBookmark) {
                            bookmarkDatastore.removeBookmarkRecord(childrenRecords[i]);
                        } else {
                            bookmarkDatastore.removeFolderRecord(childrenRecords[i]);
                        }
                    }
                }
            }
            bookmarkDatastore.commit();

        },
        onMove: function(movedNode, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry, isBookmark) {
            console.log('on moved called');
            if (!bookmarkDatastore) {
                return;
            }
            var ret;
            if (isBookmark) {
                ret = bookmarkDatastore.moveBookmark(movedNode.title, movedNode.url, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry);
            } else {
                ret = bookmarkDatastore.moveFolder(movedNode.title, newParentList, isNewEntryToolbarEntry, oldParentList, isOldEntryToolbarEntry);
            }
            bookmarkDatastore.commit();
        }
    });
}


function setup() {
    console.log('setting up');
    datastoreManager.openBookmarkDatastore(function(err, bookmarkDS) {
        if (err) {
            console.log("error opening bookmark datastore ==>", err);
            return;
        }
        bookmarkDatastore = bookmarkDS;
        if (!chromeBookmarkManager) {
            ChromeBookmarkManager.getManagerInstance(function(err, chInst) {
                if (err) {
                    console.log('error opening chrome bookmark instance');
                    return;
                }
                chromeBookmarkManager = chInst;
                setBrowserEventListener(chromeBookmarkManager);
                bookmarkDatastore.setBookmarkApi(chromeBookmarkManager);
                bookmarkDatastore.syncBookmarks();
            });
        }

    });
}

if (datastoreManager.isAuthenticated()) {
    console.log('authenticated');
    setup();
    chrome.browserAction.setTitle({
        title: 'Bookmark Box : In Sync'
    });
} else {
    chrome.browserAction.setTitle({
        title: 'Bookmark Box : Please Login'
    });
}


function signIn(callback) {
    console.log('sign in');
    datastoreManager.authenticate(function(err, tabId) {
        if (err) {
            console.log('Authentication Error');
            console.log(err);

            // firing content script error.

            chrome.tabs.executeScript(tabId, {
                file: 'js/content-scripts/tabContentScriptFail.js'
            });
            callback(true);
            return;
        }

        chrome.tabs.executeScript(tabId, {
            file: 'js/content-scripts/tabContentScriptSuccess.js'
        });
        console.log('calling setup');
        setup();
        chrome.browserAction.setTitle({
            title: 'Bookmark Box : In Sync'
        });
        callback(null);
    });
}

function signOut(callback) {
    if (bookmarkDatastore) {
        bookmarkDatastore = null;
    }
    datastoreManager.signOut();

    if (chromeBookmarkManager) {
        chromeBookmarkManager.close();
        chromeBookmarkManager = null;
    }
    chrome.browserAction.setTitle({
        title: 'Bookmark Box : Please Login'
    });
    callback();

}

function isAuthenticated() {
    if (datastoreManager) {
        return datastoreManager.isAuthenticated();
    } else {
        return false;
    }
}