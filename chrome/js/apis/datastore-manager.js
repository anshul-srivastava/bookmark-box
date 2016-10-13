var DatastoreManager = function(options) {
    var dropboxClient = null;
    var bookmarkDatastoreInstance = null;
    var datastore = null;
    var timeout = null;
    var timeOutRunning = false;

    var LOCAL_STORAGE_KEY = 'drobboxAccessToken';
    var DATASTORE_NAME = 'bookmark-box';




    this.isAuthenticated = function() {
        var token = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (token) {
            return true;
        } else {
            return false;
        }

    };

    this.authenticate = function(callback) {
        var state = new Date().getTime() + '';
        chrome.tabs.create({
            url: 'https://www.dropbox.com/oauth2/authorize?response_type=token&client_id=' + options.appKey + '&redirect_uri=' + options.redirectUrl + '&state=' + state
        }, function(openTab) {


            chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
                

                if (openTab.id === tabId && changeInfo.status === 'complete') {

                    var indexOfUrl = tab.url.indexOf(options.redirectUrl);
                    urlParams = {};
                    if (indexOfUrl === 0) {
                        var str = tab.url.substring(options.redirectUrl.length + 1);

                        var params = str.split('&')
                        for (var i = 0; i < params.length; i++) {
                            var paramParts = params[i].split('=');
                            urlParams[paramParts[0]] = paramParts[1];
                        }
                        if (urlParams['state'] === state) {
                            var accessToken = urlParams['access_token'];
                            if (accessToken) {
                                localStorage.setItem(LOCAL_STORAGE_KEY, accessToken);

                                callback(null, tabId);

                            } else {
                                callback({
                                    message: "access token not found"
                                }, tabId);
                            }

                        } else {
                            callback({
                                message: "invalid dropbox state value"
                            }, tabId);
                        }
                    } else {
                        callback({
                            message: "Invalid redirected url"
                        }, tabId);
                    }
                }

            });

        });

    };



    function openDS(dataStoreManager, retryDelay, callback) {
        if (!timeOutRunning) {
            timeout = setTimeout(function() {
                dataStoreManager.openDatastore(DATASTORE_NAME, {
                    storageType: "dropbox",
                    storageOptions: {
                        auth: {
                            token: localStorage.getItem(LOCAL_STORAGE_KEY)
                        },
                        browser: true
                    }
                }, function(err, ds) {
                    timeOutRunning = false;
                    if (err) {
                        retryDelay = retryDelay + 5000;
                        if (retryDelay >= 600000) {
                            retryDelay = 0;
                        }
                        console.log('retrying in ', retryDelay);
                        openDS(dataStoreManager, retryDelay, callback);
                    } else {

                        datastore = ds;
                        callback(null, ds);
                    }
                });
            }, retryDelay);
            timeOutRunning = true;
        } else {
            callback({
                "error": "A call to open datastore is already in progress"
            }, null);
        }
    }

    this.openBookmarkDatastore = function(callback) {

        if (bookmarkDatastoreInstance) {
            callback({
                "error": "datastore already opened"
            }, null);
        } else {
            if (datastore) {
                bookmarkDatastoreInstance = new BookmarkDatastore(datastore);
                callback(null, bookmarkDatastoreInstance);
            } else {
                openDS(DATASTORE_MANAGER, 0, function(err, datastore) {
                    if (err) {
                        callback(err, null);
                    } else {
                        bookmarkDatastoreInstance = new BookmarkDatastore(datastore);
                        callback(null, bookmarkDatastoreInstance);
                    }
                });
            }
        }
    }



    this.signOut = function(callback) {
        datastore = null;
        if (timeout) {
            clearTimeout(timeout);
        }
        if (bookmarkDatastoreInstance) {
            bookmarkDatastoreInstance.close();
            bookmarkDatastoreInstance = null;

        }

        localStorage.removeItem('drobboxAccessToken');

        chrome.storage.local.clear(function() {
            console.log('cleared');
        });

        //initializeDropboxClient();
    }

}