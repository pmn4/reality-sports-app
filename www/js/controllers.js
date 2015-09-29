angular.module('starter.controllers', [])

.controller("AppController", function ($scope, $ionicModal, AuthService) {

  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //$scope.$on('$ionicView.enter', function(e) {
  //});
})

.controller("LoginController", function ($scope, $state, AuthService) {
  // Form data for the login modal
  $scope.loginData = {};

  $scope.login = function () {
    AuthService.login($scope.loginData.username, $scope.loginData.password)
      .then(function (response) {
        $scope.closeLogin();
      }, function (response) {
        $scope.errorMessage = response.data;
      });
  };
})

.controller("LeagueController", function ($scope, $state, $stateParams, LeagueService) {
  $scope.leagues = [];

  $scope.refresh = function () {
    LeagueService.list()
      .then(function (response) {
        $scope.leagues = response.data;

        if (!$scope.leagues || $scope.leagues.length !== 1) { return; }

        $state.go("app.scoreboards-for-this-week", {
          leagueId: $scope.leagues[0].leagueId
        });
      }, function (response) {
        $state.go("app.login");
      }).finally(function () {
       // Stop the ion-refresher from spinning
       $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.$on("$ionicView.enter", $scope.refresh);
})

.controller("ScoreboardController", function ($scope, $stateParams, LeagueService, ScoreboardService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week || "";
  $scope.boxScores = [];

  $scope.setLeague = function () {
    LeagueService.set($scope.leagueId)
      .then(function (_response) {
        $scope.refresh();
      });
  };

  $scope.refresh = function () {
    ScoreboardService.fetch($scope.week)
      .then(function (response) {
        $scope.week = response.data.week;
        $scope.boxScores = response.data.boxScores;

        ScoreboardService.currentWeek($scope.week);
      }).finally(function () {
       // Stop the ion-refresher from spinning
       $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.$on("$ionicView.enter", $scope.setLeague);
})

.controller("GameController", function ($scope, $stateParams, GameService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;
  $scope.gameId = $stateParams.gameId || "";
  $scope.homeTeam = {};
  $scope.awayTeam = {};
  $scope.playerScoringData = {};

  function reformatPlayerData(homePlayers, awayPlayers) {
    // underscorejs, get in here!
    var i, p, data = {};

    for (i = 0; i < homePlayers.length; i++) {
      p = homePlayers[i];

      if (!data[p.status]) {
        data[p.status] = {};
      }

      if (!data[p.status][p.position]) {
        data[p.status][p.position] = [];
        data[p.status][p.position].homeCount = 0;
        data[p.status][p.position].awayCount = 0;
      }

      data[p.status][p.position].push({ home: p });
      data[p.status][p.position].homeCount++;
    }

    for (i = 0; i < awayPlayers.length; i++) {
      p = awayPlayers[i];

      if (!data[p.status]) {
        data[p.status] = {};
      }

      if (!data[p.status][p.position]) {
        data[p.status][p.position] = [];
        data[p.status][p.position].homeCount = 0;
        data[p.status][p.position].awayCount = 0;
      }

      if (data[p.status][p.position].awayCount < data[p.status][p.position].homeCount) {
        data[p.status][p.position][data[p.status][p.position].awayCount].away = p;
      } else {
        data[p.status][p.position].push({ away: p });
      }
      data[p.status][p.position].awayCount++;
    }

    return data;
  }

  $scope.refresh = function () {
    GameService.fetch($scope.week, $scope.gameId)
      .then(function (response) {
        $scope.homeTeam = response.data.homeTeam;
        $scope.awayTeam = response.data.awayTeam;

        if (!("playerScores" in $scope.homeTeam && "playerScores" in $scope.awayTeam)) {
          return;
        }

        $scope.playerScoringData = reformatPlayerData($scope.homeTeam.playerScores, $scope.awayTeam.playerScores);
      }).finally(function () {
       // Stop the ion-refresher from spinning
       $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.$on("$ionicView.enter", $scope.refresh);
})

.filter("range", function () {
  return function (input, min, max) {
    min = parseInt(min, 10); //Make string input int
    max = parseInt(max, 10);

    for (var i = min; i < max; i++) {
      input.push(i);
    }

    return input;
  };
})

.directive("toggleClass", function() {
  return {
    restrict: "A",
    link: function(scope, element, attrs) {
      element.bind("click", function () {
        if (element.hasClass(attrs.toggleClass)) {
          element.removeClass(attrs.toggleClass);
        } else {
          element.addClass(attrs.toggleClass);
        }
      });
    }
  };
});
;
