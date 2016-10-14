var authenticationMessenger = null;

if (window.getAuthenticationMessenger) {
    authenticationMessenger = window.getAuthenticationMessenger();
}

document.addEventListener('DOMContentLoaded', function() {

    document.getElementById('loading_container').style.display = 'none';

    var errorContainer = document.getElementById('dropbox_api_err_container');
    if (!window.DATASTORE_MANAGER) {
        errorContainer.style.display = 'block';
        return;
    }

    if (!authenticationMessenger) {
        errorContainer.style.display = 'block';
        return;
    }


    console.log('popup DOM loaded ==> ');

    var signInContainer = document.getElementById('sign_in_container');
    var logOutContainer = document.getElementById('log_out_container');
    var logOutStatus = document.getElementById('log_out_status_loading');

    var sign_in_btn = document.getElementById('sign_in_btn');
    var log_out_btn = document.getElementById('log_out_btn');



    authenticationMessenger.isAuthenticated(function(err, authenticationStatus) {
        if (authenticationStatus) {
            signInContainer.style.display = 'none';
            logOutContainer.style.display = 'block';
        } else {
            signInContainer.style.display = 'block';
            logOutContainer.style.display = 'none';
        }
    });


    sign_in_btn.addEventListener('click', function(e) {
        authenticationMessenger.signIn(function(err, signInStatus) {
            if (signInStatus) {
                signInContainer.style.display = 'none';
                logOutContainer.style.display = 'block';
            } else {
                signInContainer.style.display = 'block';
                logOutContainer.style.display = 'none';
            }
        });
    });


    log_out_btn.addEventListener('click', function(e) {

        log_out_btn.style.display = 'none';
        logOutStatus.style.display = 'block';
        authenticationMessenger.signOut(function(err, status) {
            log_out_btn.style.display = 'inline-block';
            logOutStatus.style.display = 'none';
            signInContainer.style.display = 'block';
            logOutContainer.style.display = 'none';

        });
    });
    /*
  self.port.on('signOutSuccessStatus', function(status) {

  });*/
});