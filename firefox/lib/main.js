var self = require("sdk/self");
var tabs = require("sdk/tabs");
var Panels = require("sdk/panel");


var bookmarkApi = require('./bookmarks.js');
var firefoxBookmark = bookmarkApi.getInstance(); 

var bookmarkPanel = require("./ui/bookmarkPopupPanel").getPanel(firefoxBookmark);
var bookmarkToggleButton = require("./ui/bookmarkPanelActionButton").getActionButton(bookmarkPanel, 376, 352);





//firefoxBookmark.addBookmarkToToolbar(['ok','foldertest'],"test toolbar folder insert","http://google.com");

