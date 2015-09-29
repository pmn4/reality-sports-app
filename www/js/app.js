// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('starter', [
  'ionic',
  'ionic.service.core',
  'ionic.service.deploy',
  'starter.controllers',
  'starter.services'
])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
      cordova.plugins.Keyboard.disableScroll(true);

    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

    .state('app', {
      url: '/app',
      abstract: true,
      templateUrl: 'templates/menu.html',
      controller: 'AppController'
    })

    .state("app.game", {
      url: "/leagues/:leagueId/scoreboards/:week/games/:gameId",
      views: {
        "menuContent": {
          templateUrl: "templates/game.html",
          controller: "GameController"
        }
      }
    })

    .state("app.my-game", {
      url: "/leagues/:leagueId/scoreboards/:week/games",
      views: {
        "menuContent": {
          templateUrl: "templates/game.html",
          controller: "GameController"
        }
      }
    })

    .state("app.scoreboards-for-week", {
      url: "/leagues/:leagueId/scoreboards/:week",
      views: {
        "menuContent": {
          templateUrl: "templates/scoreboard.html",
          controller: "ScoreboardController"
        }
      }
    })

    .state("app.scoreboards-for-this-week", {
      url: "/leagues/:leagueId/scoreboards",
      views: {
        "menuContent": {
          templateUrl: "templates/scoreboard.html",
          controller: "ScoreboardController"
        }
      }
    })

    .state("app.leagues", {
      url: "/leagues",
      views: {
        "menuContent": {
          templateUrl: "templates/leagues.html",
          controller: "LeagueController"
        }
      }
    })

    .state("app.login", {
      url: "/leagues",
      views: {
        "menuContent": {
          templateUrl: "templates/login.html",
          controller: "LoginController"
        }
      }
    })
  ;

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise("/app/leagues");
});
