angular.module('starter.controllers', [])

.controller("AppController", function ($scope, $ionicModal, $timeout) {

  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  // Form data for the login modal
  $scope.loginData = {};

  // Create the login modal that we will use later
  $ionicModal.fromTemplateUrl("templates/login.html", {
    scope: $scope
  }).then(function (modal) {
    $scope.modal = modal;
  });

  // Triggered in the login modal to close it
  $scope.closeLogin = function () {
    $scope.modal.hide();
  };

  // Open the login modal
  $scope.login = function () {
    $scope.modal.show();
  };

  // Perform the login action when the user submits the login form
  $scope.doLogin = function () {
    console.log("Doing login", $scope.loginData);

    // Simulate a login delay. Remove this and replace with your login
    // code if using a login system
    $timeout(function () {
      $scope.closeLogin();
    }, 1000);
  };
})

.controller("ScoreboardController", function ($scope, $stateParams, ScoreboardService) {
  $scope.week = $stateParams.week;
  $scope.leagueId = undefined; // not sure
  $scope.boxScores = [];

  $scope.refresh = function () {
    ScoreboardService.fetch($scope.week)
      .then(function (response) {
        $scope.week = response.week;
        $scope.boxScores = response.boxScores;
      });
  };

  $scope.refresh();

  $scope.$on("$ionicView.enter", $scope.refresh);
})

.controller("GameController", function ($scope, $stateParams, GameService) {
  $scope.week = $stateParams.week;
  $scope.gameId = $stateParams.gameId;
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
        $scope.homeTeam = response.homeTeam;
        $scope.awayTeam = response.awayTeam;

        if (!('playerScores' in $scope.homeTeam && 'playerScores' in $scope.awayTeam)) {
          return;
        }

        $scope.playerScoringData = reformatPlayerData($scope.homeTeam.playerScores, $scope.awayTeam.playerScores);
      });
  };

  $scope.refresh();

  $scope.$on("$ionicView.enter", $scope.refresh);
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
