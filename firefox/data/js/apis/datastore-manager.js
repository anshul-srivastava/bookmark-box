var DatastoreManager = function(dropBoxAppKey, credentials, authDriver, setCredentialsFunc) {
	var dropboxClient = null;
	var bookmarkDatastoreInstance = null;
	var datastore = null;
	var timeout = null;
	var timeOutRunning = false;
	var dropBoxDatastoreManager = null;


    console.log('credentials ==>',credentials);

	
	this.isAuthenticated = function() {
		console.log('is authenticated ==>');
		console.log('credentials ==>',credentials);
		if (credentials) {
			return true;
		} else {
			return false;
		}
	}

	this.authenticate = function(callback) {
		console.log('authenticating');
		
		if (credentials) {
			console.log('here');
			callback(null, null);
		} else {
			authDriver.doAuthorize(function(error, data) {
				console.log('error ==>',error);
				if (error) {
					if (error.code === 'access_denied') {
						
					}
					callback(error, null);
					return;
				}
				//localStorage.setItem('DropboxOAuth', JSON.stringify(client.credentials()));
				setCredentialsFunc(data.access_token);
				callback(null, data);
			});
		}
	}



	function openDS(dataStoreManager, retryDelay, callback) {
		if (!timeOutRunning) {
			timeout = setTimeout(function() {
				dataStoreManager.openDefaultDatastore(function(err, ds) {
					console.log('err ==>', err);
					timeOutRunning = false;
					if (err) {
						if (err.status && err.status != 401) {
							retryDelay = retryDelay + 5000;
							if (retryDelay >= 600000) {
								retryDelay = 0;
							}
							console.log('retrying in ', retryDelay);
							openDS(dataStoreManager, retryDelay, callback);
						} else {
							console.log('not trying');
							callback(err,null);
						}
					} else {

						datastore = ds;
						dropBoxDatastoreManager = dataStoreManager;
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
		if (!this.isAuthenticated()) {
			callback({
				"error": "Please sign in first"
			}, null);
			return;
		}
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
		dropBoxDatastoreManager = null;

		dropboxClient.signOut({}, function(err) {
			if (err) {
				console.log("error occured in signing out", err);
			}
			console.log('in dataStoreManager ==> ', 8);
			callback();
		});

		

		//initializeDropboxClient();
	}

}