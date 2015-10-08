var Mixins = {
  setLeague: function ($scope, LeagueService) {
    return function () {
      $scope.ajaxing = true;
      LeagueService.set($scope.leagueId)
        .then(function (_response) {
          $scope.refresh();
        })
        .finally(function () {
          $scope.ajaxing = false;
        });
    };
  },
  setLastUpdated: function ($scope) {
    return function (date) {
      if (date) {
        $scope.lastUpdated = date;
      }

      if (!$scope.lastUpdated) { return; }

      $scope.lastUpdatedAgo = moment($scope.lastUpdated).fromNow(true);
    };
  }
};


angular.module('starter.controllers', [])

.controller("AppController", function ($scope, AppSettings) {
  $scope.settings = AppSettings;

  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  $scope.launch = function (url) {
    window.open(url, '_system');
  };

  $scope.launchRsoPage = function (url) {
    window.open("http://www.realitysportsonline.com/" + url, '_system');
  };
})

.controller("LoginController", function ($scope, $state, AuthService, LeagueService) {
  // Form data for the login modal
  $scope.loginData = {
    username: AuthService.currentEmail(),
    optIn: true
  };

  $scope.login = function () {
    $scope.ajaxing = true;
    AuthService.login($scope.loginData)
      .then(function (response) {
        AuthService.currentEmail($scope.loginData.username);
        LeagueService.currentLeagueId("reset");

        $state.go("app.leagues");
      }, function (response) {
        // $scope.errorMessage = response.data;
        $scope.errorMessage = "Login Failed";
      })
      .finally(function () {
        $scope.ajaxing = false;
      });
  };
})

.controller("EntryController", function ($scope, $state, AuthService) {
  $scope.$on("$ionicView.enter", function () {
    if (AuthService.token()) {
      $state.go("app.leagues");
    } else {
      $state.go("app.login");
    }
  });
})

.controller("HelpController", function ($scope, $window, HelpService, AuthService) {
  $scope.helpData = {
    email: AuthService.currentEmail(),
    respondViaEmail: true
  };

  $scope.submitForm = function () {
    $scope.ajaxing = true;
    HelpService.submitFeedback($scope.helpData)
      .finally(function () {
        $scope.ajaxing = false;
      });
  }
})

.controller("LeaguesController", function ($scope, $interval, $state, $stateParams, $filter, _, AppSettings, LeagueService) {
  $scope.leagues = [];

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = _.throttle(function () {
    $scope.ajaxing = true;
    LeagueService.list()
      .then(function (response) {
        $scope.leagues = response.data;
        $scope.setLastUpdated(new Date());

        if (!$scope.leagues || $scope.leagues.length !== 1) { return; }

        $state.go("app.scoreboards-for-current-week", {
          leagueId: $scope.leagues[0].leagueId
        });
      }, function (response) {
        $state.go("app.login");
      }).finally(function () {
        $scope.ajaxing = false;

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.refresh();

  $scope.$on("$ionicView.enter", function () {
    if (!$scope.leagues || !$scope.leagues.length) {
      $scope.refresh();
    }

    $scope.setLastUpdated();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("LeagueController", function ($scope, $state, $stateParams, LeagueService) {
  var leagueId;
  $scope.setLeague = Mixins.setLeague($scope, LeagueService);

  if ($stateParams.leagueId && $stateParams.leagueId !== "default") {
    $scope.leagueId = $stateParams.leagueId;
    $scope.setLeague();
  } else {
    $scope.leagueId = LeagueService.currentLeagueId();
  }

console.log($state, $stateParams);

  var whereTo = $state.current.name.replace("-for-current-league", "");

  if ($scope.leagueId) {
    $state.go(whereTo || "app.standings", { leagueId: $scope.leagueId });
  } else {
    $state.go("app.leagues");
  }
})

.controller("ScoreboardsController", function ($scope, $interval, $filter, $stateParams, _, AppSettings, LeagueService, ScoreboardService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week || ScoreboardService.currentWeek();
  $scope.boxScores = [];

  $scope.setLeague = Mixins.setLeague($scope, LeagueService);
  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = _.throttle(function () {
    $scope.ajaxing = true;
    ScoreboardService.fetch($scope.leagueId, $scope.week)
      .then(function (response) {
        $scope.week = response.data.week;
        $scope.boxScores = response.data.boxScores;
        $scope.setLastUpdated(new Date());

        ScoreboardService.currentWeek($scope.week);
      }).finally(function () {
        $scope.ajaxing = false;

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.setLeague();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("StandingsController", function ($scope, $interval, $filter, $stateParams, _, AppSettings, LeagueService, StandingsService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.boxScores = [];

  $scope.setLeague = Mixins.setLeague($scope, LeagueService);
  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  function summarizeStandings (standings) {
    return {
      max: _.chain(standings).pluck("points").max().value()
    };
  }

  $scope.refresh = _.throttle(function () {
    $scope.ajaxing = true;
    StandingsService.fetch($scope.week)
      .then(function (response) {
        $scope.standings = response.data;
        $scope.setLastUpdated(new Date());

        $scope.summary = summarizeStandings(response.data);
      }).finally(function () {
        $scope.ajaxing = false;

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.setLeague();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("GameController", function ($scope, $state, $stateParams, $interval, $filter, $ionicActionSheet, _, AppSettings, GameService) {
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

  $scope.playerInfo = function (player) {
console.log("player", player);
    $ionicActionSheet.show({
      buttons: [
        { text: 'More Info' },
        { text: 'Twitter Search' }
      ],
      titleText: '<h3>' + player.name + '</h3><p>' + player.statLine + '</p>',
      cancelText: 'Close',
      buttonClicked: function (index) {
console.log("button clicked", arguments);
        switch (index) {
          case 0:
            $state.go("app.player", { leagueId: $scope.leagueId, playerId: $scope.playerId })
            break;
          case 1:
            $scope.launch("twitter://search?q=" + player.name);
            break;
        }
        return true;
      }
    });
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = _.throttle(function () {
    $scope.ajaxing = true;
    GameService.fetch($scope.leagueId, $scope.week, $scope.gameId)
      .then(function (response) {
        $scope.homeTeam = response.data.homeTeam;
        $scope.awayTeam = response.data.awayTeam;
        $scope.setLastUpdated(new Date());

        if (!("playerScores" in $scope.homeTeam && "playerScores" in $scope.awayTeam)) {
          return;
        }

        $scope.playerScoringData = reformatPlayerData($scope.homeTeam.playerScores, $scope.awayTeam.playerScores);
      }).finally(function () {
        $scope.ajaxing = false;

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.refresh();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("TeamController", function ($scope, $stateParams) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;
})

.controller("PlayersController", function () {
})

.controller("PlayerController", function () {
})

.controller("NewsController", function () {
})

.controller("SupportController", function () {
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

.filter("dowPlusTime", function () {
  return function (dateString) {
    if (!dateString) { return ""; }

    return moment(dateString)
      .year(new Date().getFullYear())
      .format("ddd h:mm");
  };
})

.filter("teamRecord", function () {
  return function (standing) {
    if (!standing) { return ""; }

    return [standing.wins, standing.losses, standing.ties].join("-");
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
})

.directive("highlighter", function ($timeout, AppSettings) {
  return {
    restrict: "A",
    scope: {
      model: "=highlighter"
    },
    link: function(scope, element) {
      element.addClass("highlightable");

      scope.$watch("model", function (nv, ov) {
        if (nv === ov) { return; }

        element.addClass("highlight");

        $timeout(function () {
          element.removeClass("highlight");
        }, AppSettings.highlightDuration);
      });
    }
  };
})

.controller('UpdatesController', function ($scope, $ionicDeploy) {
  // Update app code with new release from Ionic Deploy
  $scope.doUpdate = function () {
    $scope.downloading = true;
    $ionicDeploy.update().then(function (res) {
      console.log('Ionic Deploy: Update Success! ', res);
    }, function (err) {
      console.log('Ionic Deploy: Update error! ', err);
    }, function (prog) {
      $scope.percentComplete = prog;
      console.log('Ionic Deploy: Progress... ', prog);
    }).finally(function () {
      $scope.downloading = false;
    });
  };

  // Check Ionic Deploy for new code
  $scope.checkForUpdates = function () {
    $scope.ajaxing = true;
    $ionicDeploy.check().then(function (hasUpdate) {
      $scope.hasUpdate = hasUpdate;

      if (hasUpdate) {
        $scope.doUpdate();
      }
    }, function (err) {
      console.error('Ionic Deploy: Unable to check for updates', err);
    }).finally(function () {
      $scope.ajaxing = false;
    });
  }

  $scope.$on("$ionicView.enter", function () {
    $scope.checkForUpdates();
  });
})
;
