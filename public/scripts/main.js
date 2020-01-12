/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

function signIn() {
  var provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider);
  // firebase.auth().signInAnonymously();

}

function signOut() {
}

// Initiate firebase auth.
function initFirebaseAuth() {
  firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
  return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
  console.log(firebase.auth().currentUser.displayName);
  return firebase.auth().currentUser.displayName;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
  return !!firebase.auth().currentUser;
}


var pos_lat = 34.41163;
var pos_lng = -119.84766;
var pos_accuracy = 20;
var locations = {};
var markerCluster = null;

function positionCallback(position) {
    pos_lat = position.coords.latitude;
    pos_lng = position.coords.longitude;
    pos_accuracy = position.coords.accuracy;
}
function initializePosition() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(positionCallback);
  }
}


// Saves a new message on the Firebase DB.
function saveMessage(messageText) {
  // Add a new message entry to the database.
  return firebase.firestore().collection('messages').add({
    name: getUserName(),
    text: messageText,
    lat: pos_lat,
    lng: pos_lng,
    accuracy: pos_accuracy,
    profilePicUrl: getProfilePicUrl(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function (error) {
    console.error('Error writing new message to database', error);
  });
}

// Loads chat messages history and listens for upcoming ones.
var lastUpdatedMarkers = Date.now() - 100;
function loadMessages() {

  // console.log(bounds);

  // var min_lat = -360;
  // var min_lat = -360;
  // if (bounds) {
  // var min_lat = -1000;
  // var min_lng = -1000;
  // var max_lat = 1000;
  // var max_lng = 1000;
  // if (bounds) {
  //   var southWest = bounds.getSouthWest();
  //   var northEast = bounds.getNorthEast();
  //   min_lat = southWest.lat();
  //   min_lng = southWest.lng();
  //   max_lat = northEast.lat();
  //   max_lng = northEast.lng();
  // }
  // }

  // Create the query to load the last 12 messages and listen for new ones.
  var query = firebase.firestore()
                  .collection('messages')
                  // .where('lat', '>', min_lat)
                  // .where('lat', '<', max_lat)
                  // .where('lng', '>', min_lng)
                  // .where('lng', '<', max_lng)
                  // .orderBy('lat', 'asc')
                  // .where("lat", ">", min_lat)
                  // .where("lat", "<", max_lat)
                  // .orderBy('lng', 'desc')
                  .orderBy('timestamp', 'desc');
                  // .limit(12);

  
  // Start listening to the query.
  query.onSnapshot(function(snapshot) {
    // console.log(snapshot);
    // console.log("begin onsnapshot");

    var bounds = map.getBounds();
    var southWest = bounds.getSouthWest();
    var northEast = bounds.getNorthEast();
    var min_lat = southWest.lat();
    var min_lng = southWest.lng();
    var max_lat = northEast.lat();
    var max_lng = northEast.lng();

    console.log(
      southWest.lat(),
      southWest.lng(),
      northEast.lat(),
      northEast.lng(),
    )

    var recomputeall = false;
    snapshot.docChanges().forEach(function(change) {
      var message = change.doc.data();
      var lat = message.lat;
      var lng = message.lng;
      if (message.name == "fakefake") {
        recomputeall = true;
        return;
      }
      var skip = ((lat < min_lat) || (lat > max_lat) || (lng < min_lng) || (lng > max_lng));
      // console.log(min_lat, lat, max_lat, min_lng, lng, max_lng, skip);
      if ((change.type === 'removed') || skip) {
        deleteMessage(change.doc.id);
      } else {
        displayMessage(change.doc.id, message.timestamp, message.name,
                       message.text, message.profilePicUrl, message.imageUrl, message.lat, message.lng);
        locations[change.doc.id] = {lat:lat, lng:lng};
          // console.log("added this to locations dict:",change.doc.id);
        // console.log(locations);
        // console.log("foreach iteration");
        
      }
      // console.log("end onsnapshot");


    });

    if (recomputeall) {
      // locations = [];
      firebase.firestore().collection("messages").get().then(snapshot => {
          snapshot.forEach(doc => {
                    var message = doc.data();
                    var lat = message.lat;
                    var lng = message.lng;
                    if (message.name == "fakefake") {
                      recomputeall = true;
                      return;
                    }
                    var skip = ((lat < min_lat) || (lat > max_lat) || (lng < min_lng) || (lng > max_lng));
                    // console.log(min_lat, lat, max_lat, min_lng, lng, max_lng, skip);
                    locations[doc.id] = {lat:lat, lng:lng};
                      // console.log("added this to locations dict:",doc.id);
                    if (skip) {
                      deleteMessage(doc.id);
                    } else {
                      displayMessage(doc.id, message.timestamp, message.name,
                                    message.text, message.profilePicUrl, message.imageUrl, message.lat, message.lng);
                      // locations.push({lat:lat, lng:lng});
                      // console.log(locations);
                      // console.log("foreach iteration");
                      
                    }
                    // console.log("end onsnapshot");

          })
        });

    }


    // if (!recomputeall) {
      var labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        // console.log(Object.values(locations));
      var markers = Object.values(locations).map(function(value, i) {
          // console.log(value,i);
        return new google.maps.Marker({
          position: {lat:value.lat, lng:value.lng},
          label: labels[i % labels.length]
        });
      });
      if (!recomputeall && markerCluster) {
          markerCluster.clearMarkers();
      }
      markerCluster = new MarkerClusterer(map, markers, {imagePath: 'https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/m'});
      var now = Date.now();
      console.log("updated markers at ",now," since last: ",now-lastUpdatedMarkers);
      lastUpdatedMarkers = now;
    // }



  });
}

var frequencyReduce = function(delay, callback){
  var timer;
  return function(){
      clearTimeout(timer);
      timer = setTimeout(callback, delay);
  };
};


var map;
// var bounds;
function initMap() {
  // console.log("HERE");
  var myloc = {lat: pos_lat, lng: pos_lng};
  map = new google.maps.Map(
      document.getElementById('map'), {zoom: 7, center: myloc});
  // var marker = new google.maps.Marker({position: myloc, map: map});
  // console.log(marker);




  map.addListener('bounds_changed', frequencyReduce(500, function() {
    var bounds = map.getBounds();

    console.log("BOUNDS CHANGED")
    // console.log(bounds.getSouthWest().lat())
    // console.log(bounds.getSouthWest().lng())
    firebase.firestore().collection("messages").doc("viewcorner").set({
      lat:bounds.getSouthWest().lat(),
      lng:bounds.getSouthWest().lng(),
      accuracy:20,
      name:"fakefake",
      profilePicUrl:"",
      text:"fakefake",
      // timestamp = new Date(1452488445471)
      timestamp: new Date(1452488445471)
      // timestamp:"1452488445471"
    });

    // console.log(map.getBounds());
    // loadMessages(map.getBounds(), map);
    // loadMessages();


  }));

}

// Saves a new message containing an image in Firebase.
// This first saves the image in Firebase storage.
function saveImageMessage(file) {
  // 1 - We add a message with a loading icon that will get updated with the shared image.
  firebase.firestore().collection('messages').add({
    name: getUserName(),
    lat: pos_lat,
    lng: pos_lng,
    accuracy: pos_accuracy,
    imageUrl: LOADING_IMAGE_URL,
    profilePicUrl: getProfilePicUrl(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(messageRef) {
    // 2 - Upload the image to Cloud Storage.
    var filePath = firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name;
    return firebase.storage().ref(filePath).put(file).then(function(fileSnapshot) {
      // 3 - Generate a public URL for the file.
      return fileSnapshot.ref.getDownloadURL().then((url) => {
        // 4 - Update the chat message placeholder with the image's URL.
        return messageRef.update({
          imageUrl: url,
          storageUri: fileSnapshot.metadata.fullPath
        });
      });
    });
  }).catch(function(error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  });
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.firestore().collection('fcmTokens').doc(currentToken)
          .set({uid: firebase.auth().currentUser.uid});
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
  e.preventDefault();
  // Check that the user entered a message and is signed in.
  if (messageInputElement.value && checkSignedInWithMessage()) {
    saveMessage(messageInputElement.value).then(function() {
      // Clear message text field and re-enable the SEND button.
      resetMaterialTextfield(messageInputElement);
      toggleButton();
    });
  }
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) { // User is signed in!
    // Get the signed-in user's profile pic and name.
    var profilePicUrl = getProfilePicUrl();
    var userName = getUserName();

    // Set the user's profile pic and name.
    userPicElement.style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
    userNameElement.textContent = userName;

    // Show user's profile and sign-out button.
    userNameElement.removeAttribute('hidden');
    userPicElement.removeAttribute('hidden');
    signOutButtonElement.removeAttribute('hidden');

    // Hide sign-in button.
    signInButtonElement.setAttribute('hidden', 'true');

    // We save the Firebase Messaging Device token and enable notifications.
    saveMessagingDeviceToken();
  } else { // User is signed out!
    // Hide user's profile and sign-out button.
    userNameElement.setAttribute('hidden', 'true');
    userPicElement.setAttribute('hidden', 'true');
    signOutButtonElement.setAttribute('hidden', 'true');

    // Show sign-in button.
    signInButtonElement.removeAttribute('hidden');
  }
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
  // Return true if the user is signed in Firebase
  if (isUserSignedIn()) {
    return true;
  }

  // Display a message to the user using a Toast.
  var data = {
    message: 'You must sign-in first',
    timeout: 2000
  };
  signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
  return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
  element.value = '';
  element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
    '<div class="message-container">' +
      '<div class="spacing"><div class="pic"></div></div>' +
      '<div class="message"></div>' +
      '<div class="name"></div>' +
    '</div>';

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
  if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
    return url + '?sz=150';
  }
  return url;
}

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Delete a Message from the UI.
function deleteMessage(id) {
  var div = document.getElementById(id);
  // If an element for that message exists we delete it.
  if (div) {
    div.parentNode.removeChild(div);
  }
}

function createAndInsertMessage(id, timestamp) {
  const container = document.createElement('div');
  container.innerHTML = MESSAGE_TEMPLATE;
  const div = container.firstChild;
  div.setAttribute('id', id);

  // If timestamp is null, assume we've gotten a brand new message.
  // https://stackoverflow.com/a/47781432/4816918
  timestamp = timestamp ? timestamp.toMillis() : Date.now();
  div.setAttribute('timestamp', timestamp);

  // figure out where to insert new message
  const existingMessages = messageListElement.children;
  if (existingMessages.length === 0) {
    messageListElement.appendChild(div);
  } else {
    let messageListNode = existingMessages[0];

    while (messageListNode) {
      const messageListNodeTime = messageListNode.getAttribute('timestamp');

      if (!messageListNodeTime) {
        throw new Error(
          `Child ${messageListNode.id} has no 'timestamp' attribute`
        );
      }

      if (messageListNodeTime > timestamp) {
        break;
      }

      messageListNode = messageListNode.nextSibling;
    }

    messageListElement.insertBefore(div, messageListNode);
  }

  return div;
}

function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? '0'+minutes : minutes;
  var strTime = hours + ':' + minutes + '' + ampm;
  return strTime;
}
// Displays a Message in the UI.
function displayMessage(id, timestamp, name, text, picUrl, imageUrl, lat, lng) {
  var div = document.getElementById(id) || createAndInsertMessage(id, timestamp);

  // profile picture
  if (picUrl) {
    div.querySelector('.pic').style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(picUrl) + ')';
  }

    if (!timestamp) return;

  var dist_away = Math.round(latlng_dist(pos_lat,pos_lng, lat,lng));
  div.querySelector('.name').textContent = name + " ("+formatAMPM(timestamp.toDate()) + "  ~" + dist_away + "mi away)";
  var messageElement = div.querySelector('.message');

  if (text) { // If the message is text.
    messageElement.textContent = text;
    // Replace all line breaks by <br>.
    messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
  } else if (imageUrl) { // If the message is an image.
    var image = document.createElement('img');
    image.addEventListener('load', function() {
      messageListElement.scrollTop = messageListElement.scrollHeight;
    });
    image.src = imageUrl + '&' + new Date().getTime();
    messageElement.innerHTML = '';
    messageElement.appendChild(image);
  }
  // Show the card fading-in and scroll to view the new message.
  setTimeout(function() {div.classList.add('visible')}, 1);
  messageListElement.scrollTop = messageListElement.scrollHeight;
  messageInputElement.focus();
}

// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
  if (messageInputElement.value) {
    submitButtonElement.removeAttribute('disabled');
  } else {
    submitButtonElement.setAttribute('disabled', 'true');
  }
}

// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var imageFormElement = document.getElementById('image-form');
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');

// Saves message on form submit.
messageFormElement.addEventListener('submit', onMessageFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload.
imageButtonElement.addEventListener('click', function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

initializePosition();

function getRandomInRange(from, to, fixed) {
    return (Math.random() * (to - from) + from).toFixed(fixed) * 1;
    // .toFixed() returns string, so ' * 1' is a trick to convert to number
}
function addMessages(num) {
    var proms = [];
    var db = firebase.firestore();
    var batch = db.batch();

    for (var i = 0; i < num; i++) {
        var lat = getRandomInRange(34.3,35,3);
        var lng = getRandomInRange(-120,-119,3);
        // console.log(lt);
        // console.log(ln);
        batch.set(db.collection('messages').doc(), {
                // name:"John Doe",
                name:generateName(),
                text:"Hello from " +lat +", "+lng,
                lat: lat,
                lng: lng,
                accuracy:20,
                profilePicUrl:"",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
    }
    batch.commit().then(function () {
        console.log("DONE COMMITTING");
    });
}

function latlng_dist(lat1, lng1, lat2, lng2, xonly=false, yonly=false) {
    var r_earth = 3956.547; 
    var miles_per_lat_deg = Math.PI*r_earth/180.0;
    var miles_per_lng_deg = 2.0*Math.PI*r_earth*Math.cos(lat1*Math.PI/180.0)/360.0;
    var dx = (lng1-lng2)*miles_per_lng_deg;
    var dy = (lat1-lat2)*miles_per_lat_deg;
    var answer = Math.sqrt(dx*dx + dy*dy);
    if (xonly) {
        return dx
    }
    if (yonly) {
        return dy
    }
    return answer
}

// We load currently existing chat messages and listen to new ones.
loadMessages();
