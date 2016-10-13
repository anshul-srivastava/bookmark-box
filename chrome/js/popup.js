document.addEventListener('DOMContentLoaded', function() {

  var signInContainer = document.getElementById('sign_in_container');
  var logOutContainer = document.getElementById('log_out_container');
  var logOutStatus = document.getElementById('log_out_status_loading');

  var sign_in_btn = document.getElementById('sign_in_btn');
  var log_out_btn = document.getElementById('log_out_btn');

  var backgroundPage = chrome.extension.getBackgroundPage();
  if (backgroundPage.isAuthenticated()) {
    signInContainer.style.display = 'none';
    logOutContainer.style.display = 'block';
  } else {
    signInContainer.style.display = 'block';
    logOutContainer.style.display = 'none';
  }

  sign_in_btn.addEventListener('click', function(e) {

    //this.disabled = true;
    var that = this;
    backgroundPage.signIn(function(err) {
      if (err) {
        that.disabled = false;
      } else {
        signInContainer.style.display = 'none';
        logOutContainer.style.display = 'block';
      }
    });
  });

  log_out_btn.addEventListener('click', function(e) {
    var that = this;
    log_out_btn.style.display = 'none';
    logOutStatus.style.display = 'block';
    backgroundPage.signOut(function(err) {
      log_out_btn.style.display = 'inline-block';
      logOutStatus.style.display = 'none';
      signInContainer.style.display = 'block';
      logOutContainer.style.display = 'none';
    });
  });

});