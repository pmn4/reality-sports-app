var Mixins = {
  setLeague: function ($scope, LeagueService, force) {
    return function () {
      $scope.ajaxing = $scope.indicateAjaxing(true);
      LeagueService.set($scope.leagueId, force)
        .then(function (_response) {
          $scope.refresh();
        })
        .finally(function () {
          $scope.ajaxing = $scope.indicateAjaxing(false);
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
  },
  throttle: function ($scope, fn, refreshRate) {
    var throttled = _.throttle(function () {
      $scope.blocked = false;
      fn();
    }, refreshRate);

    return function () {
      $scope.blocked = true;
      throttled();
    };
  }
};


angular.module('starter.controllers', [])

.controller("AppController", function ($rootScope, $scope, $state, AppSettings, AuthTokenStore) {
  $scope.settings = AppSettings;

  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  $rootScope.indicators = {
    offline: false,
    ajaxing: 0
  };

  $scope.indicateAjaxing = function (isAjaxing) {
    if (isAjaxing) {
      $rootScope.indicators.ajaxing++;
    } else {
      $rootScope.indicators.ajaxing = Math.max(0, $rootScope.indicators.ajaxing - 1);
    }

    return isAjaxing;
  };

  $scope.launch = function (url) {
    window.open(url, '_system');
  };

  $scope.launchRsoPage = function (url) {
    window.open("http://www.realitysportsonline.com/" + url, '_system');
  };

  $scope.retryOnRsoError = function (response) {
    // @todo: TOAST something went wrong... retrying
    // @todo: only 401?
    $state.go("app.entry");
  };

  $scope.loggedIn = function (loggedIn) {
    $scope.loggedInState = loggedIn;
  };
  $scope.loggedIn(!!AuthTokenStore.token());
})

.controller("LoginController", function ($scope, $state, AuthService, AppStateService) {
  // Form data for the login modal
  $scope.loginData = {
    username: AppStateService.currentEmail(),
    optIn: true
  };

  $scope.login = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    AuthService.login($scope.loginData)
      .then(function (response) {
        AppStateService.currentEmail($scope.loginData.username);
        AppStateService.clearCurrentLeagueId();
        $scope.loggedIn(true);

        $state.go("app.leagues");
      }, function (response) {
        $scope.loggedIn(false);
        // $scope.errorMessage = response.data;
        $scope.errorMessage = "Login Failed";
      })
      .finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);
      });
  };
})

.controller("LogoutController", function ($scope, $state, AuthTokenStore) {
  $scope.$on("$ionicView.enter", function () {
    AuthTokenStore.clearToken();
    AuthTokenStore.clearSession();
    $scope.loggedIn(false);

    $state.go("app.entry");
  });
})

.controller("EntryController", function ($scope, $state, AuthService, AuthTokenStore, AppStateService) {
  $scope.$on("$ionicView.enter", function () {
    AppStateService.clearCurrentLeagueId();

    $scope.ajaxing = $scope.indicateAjaxing(true);
    AuthService.refreshSession()
      .then(function () {
        if (AuthTokenStore.token()) {
          $state.go("app.leagues");
        } else {
          $state.go("app.login");
        }
      }, function () {
        $state.go("app.login");
      })
      .finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);
      });
  });
})

.controller("HelpController", function ($scope, $window, HelpService, AppStateService) {
  $scope.helpData = {
    email: AppStateService.currentEmail(),
    respondViaEmail: true
  };

  $scope.submitForm = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    HelpService.submitFeedback($scope.helpData)
      .finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);
      });
  }
})

.controller("LeaguesController", function ($scope, $interval, $state, $stateParams, $filter, LeagueService) {
  $scope.leagues = [];

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    LeagueService.list(force)
      .then(function (data) {
        $scope.leagues = data.leagues;
        $scope.setLastUpdated(data.lastUpdated);

        if (!$scope.leagues || $scope.leagues.length !== 1) { return; }

        $state.go("app.scoreboards", {
          leagueId: $scope.leagues[0].leagueId
        });
      }, function (response) {
        // @todo: TOAST something went wrong... retrying
        $state.go("app.entry");
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

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

.controller("LeagueController", function ($scope, $state, $stateParams, LeagueService, AppStateService) {
  $scope.setLeague = Mixins.setLeague($scope, LeagueService, true);

  $scope.$on("$ionicView.enter", function () {
    if ($stateParams.leagueId && $stateParams.leagueId !== "default") {
      $scope.leagueId = $stateParams.leagueId;
      $scope.setLeague();
    } else {
      $scope.leagueId = AppStateService.currentLeagueId();
    }

    var whereTo = $state.current.name.replace("-for-current-league", "");

    if ($scope.leagueId) {
      $state.go(whereTo || "app.standings", { leagueId: $scope.leagueId });
    } else {
      $state.go("app.leagues");
    }
  });
})

.controller("ScoreboardsController", function ($scope, $interval, $filter, $stateParams, _, AppSettings, LeagueService, ScoreboardService, AppStateService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week || AppStateService.currentWeek();
  $scope.boxScores = [];

  $scope.setLeague = Mixins.setLeague($scope, LeagueService);
  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    ScoreboardService.fetch($scope.leagueId, $scope.week)
      .then(function (response) {
        $scope.week = response.data.week;
        $scope.boxScores = response.data.boxScores;
        $scope.setLastUpdated(new Date());

        AppStateService.currentWeek($scope.week);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.setLeague();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();

    if ($scope.boxScores && $scope.boxScores.length) { return; }

    // this shouldn't often happen, but sometimes we re-load a view
    // which failed to refresh the first time.
    $scope.setLeague();
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
  $scope.standings = [];

  $scope.setLeague = Mixins.setLeague($scope, LeagueService);
  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  function summarizeStandings (standings) {
    return {
      max: _.chain(standings).pluck("points").max().value()
    };
  }

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    StandingsService.fetch($scope.leagueId, $scope.week)
      .then(function (response) {
        $scope.standings = response.data;
        $scope.setLastUpdated(new Date());

        $scope.summary = summarizeStandings(response.data);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.refreshRate);

  $scope.setLeague();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();

    if ($scope.standings && $scope.standings.length) { return; }

    // this shouldn't often happen, but sometimes we re-load a view
    // which failed to refresh the first time.
    $scope.setLeague();
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
    $ionicActionSheet.show({
      buttons: [
        { text: 'More Info' },
        { text: 'Twitter Search' }
      ],
      titleText: '<h3>' + player.name + '</h3><p>' + player.statLine + '</p>',
      cancelText: 'Close',
      buttonClicked: function (index) {
        switch (index) {
          case 0:
            $state.go("app.player", { leagueId: $scope.leagueId, playerId: $scope.playerId })
            break;
          case 1:
            $scope.launch("twitter://search?query=" + player.name);
            break;
        }
        return true;
      }
    });
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    GameService.fetch($scope.leagueId, $scope.week, $scope.gameId)
      .then(function (response) {
        $scope.homeTeam = response.data.homeTeam;
        $scope.awayTeam = response.data.awayTeam;
        $scope.setLastUpdated(new Date());

        if (!("playerScores" in $scope.homeTeam && "playerScores" in $scope.awayTeam)) {
          return;
        }

        $scope.playerScoringData = reformatPlayerData($scope.homeTeam.playerScores, $scope.awayTeam.playerScores);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

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

.filter("none", function () {
  return function (arr) {
    return !arr || !arr.length;
  };
})

.filter("any", function () {
  return function (arr) {
    return arr && arr.length;
  };
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
    $scope.ajaxing = $scope.indicateAjaxing(true);
    $ionicDeploy.check().then(function (hasUpdate) {
      $scope.hasUpdate = hasUpdate;

      if (hasUpdate) {
        $scope.doUpdate();
      }
    }, function (err) {
      console.error('Ionic Deploy: Unable to check for updates', err);
    }).finally(function () {
      $scope.ajaxing = $scope.indicateAjaxing(false);
    });
  }

  $scope.$on("$ionicView.enter", function () {
    $scope.checkForUpdates();
  });
})
;
