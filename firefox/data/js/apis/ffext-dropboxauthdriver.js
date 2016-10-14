window.FFExtDropboxAuthdriver = function(appKey, oauthRedirectUrl, authorizeFunc) {

    var redirectURL = oauthRedirectUrl;
    this.authType = function() {
        return "token";
    }

    this.url = function() {
        return redirectURL;
    }

    this.doAuthorize = function(callback) {
        var state = new Date().getTime() + '';
        var authUrl = 'https://www.dropbox.com/oauth2/authorize?response_type=token&client_id=' + appKey + '&redirect_uri=' + redirectURL + '&state=' + state
        authorizeFunc({
            authUrl: authUrl,
            state: state
        }, function(err, data) {
            if (err) {
                return callback(err, null);
            }
            if (data.state === state) {
                callback(null, data);
            } else {
                callback({
                    message: "Invalid State Params"
                }, data);
            }
        });

    }


}