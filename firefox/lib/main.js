var self = require("sdk/self");
var tabs = require("sdk/tabs");
var Panels = require("sdk/panel");
var notifications = require("sdk/notifications");
var simpleStorage = require("sdk/simple-storage");






exports.main = function(options, callbacks) {
    console.log('loaded ===> ', options);
    if (options.loadReason === 'install' || options.loadReason === 'upgrade') {
        delete simpleStorage.storage.DropboxOAuth;
        delete simpleStorage.storage.lastSyncTime;
        notifications.notify({
            title: "Bookmark Box - Sign In Required",
            text: "Please sign in with your dropbox account to sync your bookmarks",
            iconURL: self.data.url("img/Bookmark-Box-icon-38.png")
        });
    } else {

        var bookmarkApi = require('./bookmarks.js');
        var firefoxBookmark = bookmarkApi.getInstance();

        var bookmarkPanel = require("./ui/bookmarkPopupPanel").getPanel(firefoxBookmark);
        var bookmarkToggleButton = require("./ui/bookmarkPanelActionButton").getActionButton(bookmarkPanel, 376, 352);

    }

};


//firefoxBookmark.addBookmarkToToolbar(['ok','foldertest'],"test toolbar folder insert","http://google.com");