function isProduction() {
  return window.location.host.indexOf("localhost") < 0 || // prod in browser
    !!window.cordova; // prod in app
}

// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('starter', [
  'ionic','ionic.service.core',
  'ngIOS9UIWebViewPatch',

  'ionic.service.analytics',
  'ionic.service.deploy',
  'starter.controllers',
  'starter.services',
  'ngCordova'
])

.run(function ($rootScope, $ionicPlatform, $ionicAnalytics, $ionicDeploy) {
  $ionicPlatform.ready(function () {
    Ionic.io();

    $ionicAnalytics.register();

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

    $ionicDeploy.check()
      .then(function (hasUpdate) {
        $rootScope.hasAppUpdate = hasUpdate;
      }, function () {
        $rootScope.hasAppUpdate = false;
      });
  });
})

.config(function ($httpProvider, $stateProvider, $urlRouterProvider) {
  $httpProvider.interceptors.push("authHeaderTokenInterceptor");

  $stateProvider

    .state('app', {
      url: '/app',
      abstract: true,
      templateUrl: 'templates/menu.html',
      controller: 'AppController'
    })

    .state("app.game", {
      url: "/leagues/:leagueId/weeks/:week/games/:gameId",
      views: {
        "menuContent": {
          templateUrl: "templates/game.html",
          controller: "GameController"
        }
      }
    })

    // not sure this works
    .state("app.my-game", {
      url: "/leagues/:leagueId/weeks/:week/games",
      views: {
        "menuContent": {
          templateUrl: "templates/game.html",
          controller: "GameController"
        }
      }
    })

    .state("app.standings-for-current-league", {
      url: "/leagues/default/weeks/default/standings",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.standings", {
      url: "/leagues/:leagueId/weeks/:week/standings",
      views: {
        "menuContent": {
          templateUrl: "templates/standings.html",
          controller: "StandingsController"
        }
      }
    })

    .state("app.scoreboards-for-current-league", {
      url: "/leagues/default/weeks/default/scoreboards",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.scoreboards", {
      url: "/leagues/:leagueId/weeks/:week/scoreboards",
      views: {
        "menuContent": {
          templateUrl: "templates/scoreboards.html",
          controller: "ScoreboardsController"
        }
      }
    })

    .state("app.league-for-current-league", {
      url: "/leagues/default",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.league", {
      url: "/leagues/:leagueId",
      views: {
        "menuContent": {
          templateUrl: "templates/league.html",
          controller: "LeagueController"
        }
      }
    })

    .state("app.leagues", {
      url: "/leagues",
      views: {
        "menuContent": {
          templateUrl: "templates/leagues.html",
          controller: "LeaguesController"
        }
      }
    })

    .state("app.roster-for-current-league", {
      url: "/leagues/default/teams/default/players?roster",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "RosterController"
        }
      }
    })

    .state("app.roster", {
      url: "/leagues/:leagueId/teams/:teamId/players?roster",
      views: {
        "menuContent": {
          templateUrl: "templates/roster.html",
          controller: "RosterController"
        }
      }
    })

    .state("app.team-for-current-league", {
      url: "/leagues/default/teams/default",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.team", {
      url: "/leagues/:leagueId/teams/:teamId",
      views: {
        "menuContent": {
          templateUrl: "templates/team.html",
          controller: "TeamController"
        }
      }
    })

    .state("app.team-news-for-current-league", {
      url: "/leagues/default/teams/default/news",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.team-news", {
      url: "/leagues/:leagueId/teams/:teamId/news",
      views: {
        "menuContent": {
          templateUrl: "templates/news.html",
          controller: "TeamNewsController"
        }
      }
    })

    .state("app.player-for-current-league", {
      url: "/leagues/default/players/:playerId",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.players-for-current-league", {
      url: "/leagues/default/players?playerFilter&posFilter&txtSearch",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.players", {
      url: "/leagues/:leagueId/players?playerFilter&posFilter&txtSearch",
      views: {
        "menuContent": {
          templateUrl: "templates/players.html",
          controller: "PlayersController"
        }
      }
    })

    .state("app.player", {
      url: "/leagues/:leagueId/players/:playerId",
      views: {
        "menuContent": {
          templateUrl: "templates/player.html",
          controller: "PlayerController"
        }
      }
    })

    .state("app.bid", {
      url: "/leagues/:leagueId/team/:teamId/players/:playerId",
      views: {
        "menuContent": {
          templateUrl: "templates/bid.html",
          controller: "BidController"
        }
      }
    })

    .state("app.news-for-current-league", {
      url: "/leagues/default/news",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.news", {
      url: "/leagues/:leagueId/news",
      views: {
        "menuContent": {
          templateUrl: "templates/news.html",
          controller: "NewsController"
        }
      }
    })

    .state("app.transactions-for-current-league", {
      url: "/leagues/default/weeks/default/transactions",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "CurrentLeagueController"
        }
      }
    })

    .state("app.transactions", {
      url: "/leagues/:leagueId/weeks/:week/transactions",
      views: {
        "menuContent": {
          templateUrl: "templates/transactions.html",
          controller: "TransactionsController"
        }
      }
    })

    .state("app.entry", {
      url: "/entry",
      views: {
        "menuContent": {
          templateUrl: "templates/entry.html",
          controller: "EntryController"
        }
      }
    })

    .state("app.help", {
      url: "/help",
      views: {
        "menuContent": {
          templateUrl: "templates/help.html",
          controller: "HelpController"
        }
      }
    })

    .state("app.login", {
      url: "/login",
      views: {
        "menuContent": {
          templateUrl: "templates/login.html",
          controller: "LoginController"
        }
      }
    })

    .state("app.logout", {
      url: "/logout",
      views: {
        "menuContent": {
          templateUrl: "templates/redirecting.html",
          controller: "LogoutController"
        }
      }
    })

    .state("app.updates", {
      url: "/updates",
      views: {
        "menuContent": {
          templateUrl: "templates/updates.html",
          controller: "UpdatesController"
        }
      }
    })

    .state("app.support", {
      url: "/support",
      views: {
        "menuContent": {
          templateUrl: "templates/support.html",
          controller: "SupportController"
        }
      }
    })
  ;

  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise("/app/entry");
})

.factory("authHeaderTokenInterceptor", function (AppSettings, AuthTokenStore, AppStateService) {
  return {
    request: function (config) {
      var token = AuthTokenStore.token(), session = AuthTokenStore.session();

      if (!token && !session) { return config; }
      if (!config.url || config.url.indexOf(AppSettings.apiHost) !== 0) {
        return config;
      }

      config.headers = config.headers || {};
      // add token to request headers

      if (token) {
        config.headers["X-RSO-Auth-Token"] = token;
      }
      if (session) {
        config.headers["X-RSO-Session"] = session;
      }

      return config;
    },

    response: function (response) {
      var token, session;

      if (!response && !response.headers) { return response; }
      if (!response.config.url || response.config.url.indexOf(AppSettings.apiHost) !== 0) {
        return response;
      }

      if (response.status === 401) {
        AuthTokenStore.clearSession(session);
        AppStateService.clearCurrentLeagueId();
      }

      token = response.headers("X-RSO-Auth-Token");
      session = response.headers("X-RSO-Session");

      if (token) {
        AuthTokenStore.token(token);
      }
      if (session) {
        AuthTokenStore.session(session);
      }

      return response;
    }
  };
})

.constant("_", window._)

.constant("moment", window.moment)

.constant("AppSettings", {
  apiHost: isProduction() ? "http://reality-sports-app.herokuapp.com" : "/api",
  throttleRate: 20 * 1000, // 20 seconds
  gamesRefreshRate: 2 * 60 * 1000, // 2 minutes
  scoreboardsRefreshRate: 5 * 60 * 1000, // 5 minutes
  highlightDuration: 5 * 1000 // 5 seconds (+ 1 for fade out in css)
})
;
