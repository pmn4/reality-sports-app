var Mixins = {
  setLastUpdated: function ($scope) {
    return function (date) {
      if (date) {
        $scope.lastUpdated = date;
      }

      if (!$scope.lastUpdated) { return; }

      $scope.lastUpdatedAgo = moment($scope.lastUpdated).fromNow(true);
    };
  },
  refreshable: function ($scope, refreshRate, properties) {
    return function () {
      // never updated?  true.
      if (!$scope.lastUpdated) { return true; }

      // updated, but no data?  true.
      if (_.all(properties, function (p) { _.isEmpty($scope[p]) })) {
        return true;
      }

      // last updated more than <refreshRage> ago?
      return $scope.lastUpdated.getTime() + refreshRate < new Date();
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

.controller("AppController", function ($rootScope, $scope, $state, $cordovaToast, AppSettings, AuthTokenStore, AppStateService) {
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
    if (response.status === 401) {
      $state.go("app.logout");
    } else {
      $cordovaToast.show(response.data || "Request failed", "short", "bottom");
    }
  };

  $scope.loggedIn = function (loggedIn) {
    $scope.loggedInState = loggedIn;
  };
  $scope.loggedIn(!!AuthTokenStore.token());

  if (!AppStateService.currentWeek()) {
    AppStateService.currentWeek(AppStateService.guessCurrentWeek());
  }
})

.controller("LoginController", function ($scope, $state, $cordovaToast, AuthService, AppStateService) {
  // Form data for the login modal
  $scope.loginData = {
    username: AppStateService.currentEmail()
  };

  $scope.login = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    AuthService.login($scope.loginData)
      .then(function (response) {
        AppStateService.currentEmail($scope.loginData.username);
        AppStateService.clearCurrentLeagueId();
        $scope.loggedIn(true);

        initializeIonicUser(response.data);

        $state.go("app.leagues");
      }, function (response) {
        $scope.loggedIn(false);
        $scope.errorMessage = response.data || "Login Failed";
        $cordovaToast.show(response.data || "Login Failed", "long", "bottom");
      })
      .finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);
      });
  };

  // move to a service?
  function initializeIonicUser(response) {
    try {
      if (!response) { response = {}; }

      // this will give you a fresh user or the previously saved 'current user'
      var user = Ionic.User.current();

      if (response.userHash) {
        user.id = response.userHash;
      } else if (!user.id) {
        // I hope this is never the case, because, then I just don't know...
        user.id = Ionic.User.anonymousId();
      }
      if (response.userName) {
        user.set("username", response.userName);
      }
      if (response.userId) {
        user.set("rsoUserId", response.userId);
      }

      user.save();
    } catch (e) {
      // @todo: send error report?
      console.log(e);
    }
  }
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
    // ok to remove?
    AppStateService.clearCurrentLeagueId();

    if (AuthTokenStore.token()) {
      $state.go("app.leagues");
    } else {
      $state.go("app.login");
    }
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

.controller("LeaguesController", function ($scope, $interval, $state, $stateParams, $filter, LeagueService, AppStateService) {
  $scope.leagues = [];

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    LeagueService.list(force)
      .then(function (response) {
        $scope.leagues = response.data;
        $scope.setLastUpdated(new Date());

        if (!$scope.leagues || !$scope.leagues.length) {
          return $scope.retryOnRsoError({
            status: 404,
            data: 'No leagues found'
          });
        }
        if (!$scope.leagues || $scope.leagues.length !== 1) { return; }

        $scope.gotoLeague($scope.leagues[0]);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.gotoLeague = function (league) {
    AppStateService.currentLeagueId(league.leagueId);

    $state.go("app.scoreboards", {
      leagueId: league.leagueId,
      week: AppStateService.currentWeek()
    });
  };

  $scope.refresh();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();

    if ($scope.leagues && $scope.leagues.length || $scope.ajaxing) { return; }

    $scope.refresh();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("LeagueController", function ($scope, $state, $stateParams, AppStateService) {
  $scope.$on("$ionicView.enter", function () {
    if ($stateParams.leagueId && $stateParams.leagueId !== "default") {
      $scope.leagueId = $stateParams.leagueId;
    } else {
      $scope.leagueId = AppStateService.currentLeagueId();
    }

    if ($stateParams.week && $stateParams.week !== "default") {
      $scope.week = $stateParams.week;
    } else {
      $scope.week = AppStateService.currentWeek();
    }

    var whereTo = $state.current.name.replace("-for-current-league", "");

    if ($scope.leagueId) {
      $state.go(whereTo || "app.standings", {
        leagueId: $scope.leagueId,
        week: $scope.week
      }, { location: 'replace' });
    } else {
      $state.go("app.leagues");
    }
  });
})

.controller("ScoreboardsController", function ($scope, $ionicPlatform, $state, $interval, $filter, $stateParams, _, AppSettings, ScoreboardService, AppStateService, ImageCache, CacheService) {
  var fnEnterEventHandler, fnExitEventHandler;

  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;
  $scope.boxScores = null;

  $scope.currentLeague = CacheService.getLeagueById($scope.leagueId);

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);
  $scope.refreshable = Mixins.refreshable($scope, AppSettings.scoreboardsRefreshRate, ["boxScores"]);

  if (!$scope.week || $scope.week === "default") {
    $scope.week = AppStateService.currentWeek();
  }

  // assumes that all raw date has already been applied to $scope
  $scope.repaint = function () {
    if (!$scope.boxScores || !$scope.boxScores.length) { return; }
    if (!$scope.currentLeague || !$scope.currentLeague.team) { return; }

    $scope.boxScores = _.sortBy($scope.boxScores, function (boxScore, index) {
      return boxScore.awayTeam.team.teamId === $scope.currentLeague.team.teamId ||
        boxScore.homeTeam.team.teamId === $scope.currentLeague.team.teamId ? -1 : index;
    });
  };

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    ScoreboardService.fetch($scope.leagueId, $scope.week)
      .then(function (response) {
        var data = response.data || {};
        if (data.week) {
          $scope.week = data.week;
        }
        $scope.boxScores = data.boxScores || [];
        $scope.setLastUpdated(new Date());

        AppStateService.currentWeek($scope.week);

        $scope.repaint();

        ImageCache.logosFromBoxScores($scope.boxScores);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.throttleRate);

  $scope.setWeek = function (week) {
    $state.go("app.scoreboards", {
      leagueId: $scope.leagueId,
      week: week
    });
  };

  $scope.refresh();

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);

  fnEnterEventHandler = function () {
    $scope.setLastUpdated();

    if ($scope.ajaxing) { return; }
    if (!$scope.refreshable()) { return; }

    $scope.refresh();
  };

  $scope.$on("$ionicView.enter", function () {
    fnEnterEventHandler();

    if (fnExitEventHandler && fnExitEventHandler.call) { return; }

    // when bringing the app back into the foreground
    fnExitEventHandler = $ionicPlatform.on("resume", fnEnterEventHandler);
  });
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);

    if (fnExitEventHandler && fnExitEventHandler.call) {
      fnExitEventHandler();
      fnExitEventHandler = null;
    }
  });
})

.controller("StandingsController", function ($scope, $state, $interval, $filter, $stateParams, _, AppSettings, StandingsService, AppStateService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;
  $scope.divisionStandings = null;

  if (!$scope.week || $scope.week === "default") {
    $scope.week = AppStateService.currentWeek();
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    StandingsService.fetch($scope.leagueId, $scope.week - 1)
      .then(function (response) {
        var data = response.data || {};

        $scope.divisionStandings = data.divisionStandings || [];
        $scope.summary = data.meta;
        $scope.setLastUpdated(new Date());

        AppStateService.currentWeek($scope.week);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.throttleRate);

  $scope.setWeek = function (week) {
    $state.go("app.standings", {
      leagueId: $scope.leagueId,
      week: week
    });
  };

  $scope.refresh();

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();

    if ($scope.ajaxing) { return; }
    if ($scope.divisionStandings && $scope.divisionStandings.length) { return; }

    // this shouldn't often happen, but sometimes we re-load a view
    // which failed to refresh the first time.
    $scope.refresh();
  });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("GameController", function ($scope, $ionicPlatform, $state, $stateParams, $interval, $filter, $ionicActionSheet, _, AppSettings, GameService) {
  var fnEnterEventHandler, fnExitEventHandler;

  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;
  $scope.gameId = $stateParams.gameId || "";
  $scope.homeTeam = {};
  $scope.awayTeam = {};
  $scope.playerScoringData = {};

  function reformatPlayerData(homePlayers, awayPlayers) {
    // underscorejs, get in here!
    var i, p, pos, data = {};

    for (i = 0; i < homePlayers.length; i++) {
      p = homePlayers[i];

      if (!data[p.status]) {
        data[p.status] = {};
      }

      pos = p.position;

      if (!data[p.status][pos]) {
        data[p.status][pos] = [];
        data[p.status][pos].homeCount = 0;
        data[p.status][pos].awayCount = 0;
      }

      data[p.status][pos].push({ home: p });
      data[p.status][pos].homeCount++;
    }

    for (i = 0; i < awayPlayers.length; i++) {
      p = awayPlayers[i];

      if (!data[p.status]) {
        data[p.status] = {};
      }

      pos = p.position;

      if (!data[p.status][pos]) {
        data[p.status][pos] = [];
        data[p.status][pos].homeCount = 0;
        data[p.status][pos].awayCount = 0;
      }

      if (data[p.status][pos].awayCount < data[p.status][pos].homeCount) {
        data[p.status][pos][data[p.status][pos].awayCount].away = p;
      } else {
        data[p.status][pos].push({ away: p });
      }
      data[p.status][pos].awayCount++;
    }

    return data;
  }

  $scope.playerInfo = function (playerData) {
    $ionicActionSheet.show({
      buttons: [
        { text: 'More Info' },
        { text: 'Twitter Search' }
      ],
      titleText: [
        "<h3>",
        $filter("playerFullName")(playerData.player),
        // " <span class='player-team'>(",
        // playerData.player.position,
        // " ",
        // playerData.player.nflTeam,
        // ")</span>",
        "</h3><p>",
        $filter("nflGameSummary")(playerData.game),
        "</p><p>Projected: ",
        playerData.projectedPoints,
        "</p><p>",
        playerData.statLine,
        "</p>"
      ].join(""),
      cancelText: 'Close',
      buttonClicked: function (index) {
        switch (index) {
          case 0:
            $state.go("app.player", {
              leagueId: $scope.leagueId,
              playerId: $scope.playerId
            });
            break;
          case 1:
            $scope.launch("twitter://search?query=" + $filter("playerFullName")(playerData.player));
            break;
        }
        return true;
      }
    });
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);
  $scope.refreshable = Mixins.refreshable($scope, AppSettings.gamesRefreshRate, ["homeTeam", "awayTeam"]);

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
  }, AppSettings.throttleRate);

  $scope.refresh();

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);

  fnEnterEventHandler = function () {
    $scope.setLastUpdated();

    if ($scope.ajaxing) { return; }
    if (!$scope.refreshable()) { return; }

    $scope.refresh();
  };

  // when navigating to this page from elsewhere in the app
  $scope.$on("$ionicView.enter", function () {
    fnEnterEventHandler();

    if (fnExitEventHandler && fnExitEventHandler.call) { return; }

    // when bringing the app back into the foreground
    fnExitEventHandler = $ionicPlatform.on("resume", fnEnterEventHandler);
  });

  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);

    if (fnExitEventHandler && fnExitEventHandler.call) {
      fnExitEventHandler();
      fnExitEventHandler = null;
    }
  });
})

.controller("TeamController", function ($scope, $state, $stateParams, $interval, $ionicPopup, $q, AppSettings, AppStateService, CacheService, TeamService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = Mixins.throttle($scope, function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);

    TeamService.fetch($scope.leagueId, $scope.teamId)
      .then(function (response) {
        $scope.team = response.data || {};
        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  }, AppSettings.throttleRate);

  $scope.refresh();

  function currentLeagueTeamId() {
    var league = _.find(CacheService.leagues(), function (league) {
      // likely comparing string to int
      return league.leagueId == AppStateService.currentLeagueId();
    });

    if (!league || !league.team) { return; }

    return league.team.teamId;
  }

  $scope.$watch("team", function (team) {
    $scope.editable = team &&
      team.teamId == currentLeagueTeamId() &&
      _.chain(team.startingPositions)
        .map(function (p) { return p.player; })
        .compact()
        .any(function (p) { return !p.isLocked; })
        .value();
  })

  $scope.$on("$ionicView.enter", function () {
    var whereTo, teamId;

    if (!$stateParams.leagueId || $stateParams.leagueId === "default") {
      $scope.leagueId = AppStateService.currentLeagueId();
    }

    if ($stateParams.teamId && $stateParams.teamId !== "default") {
      return;
    }

    whereTo = $state.current.name.replace("-for-current-league", "");
    teamId = currentLeagueTeamId();

    if (teamId) {
      $state.go(whereTo || "app.standings", {
        leagueId: $scope.leagueId,
        teamId: teamId
      }, { location: 'replace' });
    } else {
      $state.go("app.leagues");
    }
  });

  // $scope.$on("$ionicView.enter", function () {
  //   $scope.setLastUpdated();

  //   if ($scope.ajaxing) { return; }
  //   if ($scope.divisionStandings && $scope.divisionStandings.length) { return; }

  //   // this shouldn't often happen, but sometimes we re-load a view
  //   // which failed to refresh the first time.
  //   $scope.refresh();
  // });
  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });

  // end boilerplate stuff

  $scope.assignPosition = function (position) {
    var players;

    if (!$scope.editable) { return; }

    players = _.chain($scope.team.lineupPlayers)
      .select(function (player) {
        return _.contains(position.positionsAllowed, player.pos);
      })
      .reject(function (player) {
        return position.player &&
          player.playerId === position.player.playerId ||
          player.startingSlot;
      })
      .value();

    swapPlayer(position, players)
      .then(function (playerId) {
        $scope.ajaxing = $scope.indicateAjaxing(true);

        TeamService.insertPlayer($scope.leagueId, $scope.teamId, position, playerId)
          .then(function (response) {
            $scope.refresh();
          }, function (response) {
            // @ todo: error message
          }).finally(function () {
            $scope.ajaxing = $scope.indicateAjaxing(false);
          });
      }, function (response) {
      if (!response) { return; /* cancel */ }
      });
  };

  function swapPlayer(position, players) {
    var deferred = $q.defer(), scope = $scope.$new();
    scope.players = players;
    scope.swap = { player: {} };

    var swapPlayerPopup = $ionicPopup.show({
      template: '<ion-list>'+
  '<ion-radio ng-repeat="player in players" ng-model="swap.player" ng-value="\'{{ player.playerId }}\'">' +
    '{{ player | playerDisplayName }}' +
    (position.positionsAllowed.length > 1 ? ', {{ player.pos }}' : '') +
    '<span class="player-team">' +
      ' {{ player | nflTeam }}' +
    '</span>' +
  '</ion-radio>' +
'</ion-list>',
      title: "Position: " + position.slotLabel,
      scope: scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Save</b>',
          type: 'button-positive',
          onTap: function(e) {
            if (!scope.swap.player) {
              e.preventDefault();
            } else {
              return scope.swap.player;
            }
          }
        }
      ]
    });

    swapPlayerPopup.then(function (response) {
      if (response) {
        deferred.resolve(response);
      } else {
        deferred.reject(response);
      }
    }, function (response) {
      deferred.reject(response);
    });

    return deferred.promise;
  }
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

.filter("nullIf", function () {
  return function (val, condition) {
    if ( val === condition ) { return; }

    return val;
  };
})

.filter("range", function () {
  return function (input, min, max) {
    min = parseInt(min, 10);
    max = parseInt(max, 10);

    for (var i = min; i <= max; i++) {
      input.push(i);
    }

    return input;
  };
})

.filter("dowPlusTime", function (moment) {
  var DATE_STRING_RE = /^\w+ \d+ \d+:\d+$/i;
  return function (dateString, format) {
    if (!DATE_STRING_RE.test(dateString)) { return dateString; }

    return moment(dateString, "MMM D h:mm")
      .year(new Date().getFullYear())
      .format("ddd h:mm");
  };
})

.filter("nflGameYetToStart", function () {
  var FUTURE_GAME_RE = /^\w+ \d+ \d+:\d+$/i;
  return function (game) {
    if (!game) { return ""; }

    return FUTURE_GAME_RE.test(game.gameStatus);
  };
})

.filter("teamRecord", function () {
  return function (standing, hasTies) {
    var pieces;

    if (!standing) { return ""; }

    pieces = [standing.wins, standing.losses];

    if (hasTies) {
      pieces.push(standing.ties);
    }

    return pieces.join("-");
  };
})

.filter("toFixed", function () {
  return function (total, digits) {
    if (total == null) { return; }

    return total.toFixed(digits);
  };
})

.filter("toCommaSeparated", function () {
  return function (figure) {
    if (figure == null) { return; }

    return Number(Math.round(figure)).toLocaleString();
  };
})

.filter("adjustment", function () {
  return function (summary, digits) {
    var adjustment;

    if (summary == null || !summary.adjustedPoints || !summary.projectedPoints) {
      return;
    }

    adjustment = summary.adjustedPoints - summary.projectedPoints;

    return (adjustment >= 0 ? "+" : "") + adjustment.toFixed(digits);
  };
})

.filter("summaryAdjustmentClass", function () {
  return function (summary) {
    var adjustment;

    if (summary == null || !summary.adjustedPoints || !summary.projectedPoints) {
      return;
    }

    adjustment = summary.adjustedPoints / summary.projectedPoints;

    if (adjustment > 1.40) { return "adjustment-plus-3"; }
    if (adjustment > 1.20) { return "adjustment-plus-2"; }
    if (adjustment > 1.05) { return "adjustment-plus-1"; }
    if (adjustment > 1 / 1.05) { return "adjustment-in-line"; }
    if (adjustment > 1 / 1.20) { return "adjustment-minus-1"; }
    if (adjustment > 1 / 1.05) { return "adjustment-minus-2"; }
    return "adjustment-minus-3";
  };
})

.filter("playerAdjustmentClass", function () {
  return function (summary) {
    var adjustment;

    if (summary == null || !summary.adjustedPoints || !summary.projectedPoints) {
      return;
    }

    adjustment = summary.adjustedPoints / summary.projectedPoints;

    if (adjustment > 2.00) { return "adjustment-plus-3"; }
    if (adjustment > 1.55) { return "adjustment-plus-2"; }
    if (adjustment > 1.25) { return "adjustment-plus-1"; }
    if (adjustment > 0.75) { return "adjustment-in-line"; }
    if (adjustment > 0.75) { return "adjustment-minus-1"; }
    if (adjustment > 0.50) { return "adjustment-minus-2"; }
    return "adjustment-minus-3";
  };
})

.filter("separateThousands", function () {
  return function (num) {
    if (num == null) { return; }

    return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
})

.filter("playerFullName", function () {
  return function (player) {
    if (!player) { return; }

    return [player.firstName, player.lastName].join(" ");
  };
})

.filter("playerDisplayName", function () {
  return function (player) {
    var str;

    if (!player) { return; }

    if (player.position === "DF") { return player.firstName; }

    if (player.firstName) {
      if (player.firstName[1] === ".") {
        str = player.firstName;
      } else {
        str = player.firstName[0] + ".";
      }
    }

    return str + " " + player.lastName;
  };
})

.filter("nflTeam", function () {
  return function (player) {
    if (!player) { return; }

    return player.nflTeam;
  };
})

.filter("isGameFinal", function () {
  return function (game) {
    if (!game) { return; }

    return game.gameStatus === "Final";
  };
})

.filter("isByeWeek", function () {
  return function (game) {
    if (!game) { return; }

    return game.opponent === "BYE";
  };
})

.filter("nflGameSummary", function ($filter) {
  return function (game) {
    var tokens = [];
    if (!game) { return; }

    if (game.opponent === "BYE") {
      return game.opponent;
    }

    // {{ playerData.home.game.gameStatus.date | dowPlusTime }}
    // {{ playerData.home.game.gameStatus }}
    // {{ playerData.home.game.teamScore }}
    // {{ playerData.home.game.team }}
    // :
    // {{ playerData.home.game.opponent }}
    // {{ playerData.home.game.opponentScore }}
    // {{ playerData.home.game.timeRemaining || playerData.home.game.gameStatus }}

    if (game.timeRemaining) {
      tokens.push(game.timeRemaining);
    } else {
      tokens.push($filter("dowPlusTime")(game.gameStatus));
    }

    if (!$filter("nflGameYetToStart")(game)) {
      tokens.push(game.teamScore);
      tokens.push("-");
      tokens.push(game.opponentScore);
    }
    tokens.push(game.opponent);

    return tokens.join(" ");
  };
})

.filter("teamLogo", function (ImageCache) {
  return function (team) {
    if (!team) { return ""; }

    return ImageCache.teamLogo(team);
  }
})

.filter("boxScoreForTeam", function (_) {
  return function (boxScore, teamId) {
    if (!boxScore || !teamId) { return; }

    return boxScore.awayTeam.team.teamId === teamId ||
      boxScore.homeTeam.team.teamId === teamId;
  }
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
    link: function (scope, element) {
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

.directive("rsaWeekChooser", function ($ionicScrollDelegate, $timeout) {
  return {
    restrict: "E",

    scope: {
      week: "=",
      firstWeek: "=",
      lastWeek: "=",
      onChooseWeek: "&"
    },

    templateUrl: "templates/directives/week-chooser.html",

    link: function (scope, element, attrs) {
      if (!scope.firstWeek) {
        scope.firstWeek = 1;
      }
      if (!scope.lastWeek) {
        scope.lastWeek = 17;
      }

      $timeout(function () { // "ensure" the chooser is rendered
        scope.$watch(attrs.week, function (value) {
          var query, scrollPosition;

          if (!element || !element[0]) { return; }

          query = element[0].querySelectorAll("[data-week='" + scope.week + "']");

          if (!query || !query[0]) { return; }

          if (element[0].children && element[0].children[0]) {
            // can't sort out how to make rsa-week-chooser have a width
            scrollPosition = element[0].children[0].clientWidth;
          }

          scrollPosition = query[0].clientWidth / 2 + query[0].offsetLeft - scrollPosition / 2;

          $ionicScrollDelegate
            .$getByHandle("week-chooser")
            .scrollTo(scrollPosition, 0, true);
        });
      });
    }
  }
})

.directive("rsaBoxScore", function (_, StandingsService) {
  return {
    restrict: "E",

    scope: {
      leagueId: "=",
      week: "=",
      boxScore: "="
    },

    templateUrl: "templates/directives/box-score.html",

    link: function (scope, _element, attrs) {
      if (scope.standings) { return; }
      if (!scope.leagueId) { return; }
      if (!scope.week) { return; }
      if (!scope.boxScore) { return; }

      StandingsService.fetch(scope.leagueId, scope.week - 1)
        .then(function (response) {
          standingsByTeam(response.data);
        });

      function standingsByTeam(standingsData) {
        var flatStandings;

        if (!standingsData) { return; }

        flatStandings = _.chain(standingsData.divisionStandings)
          .pluck("teamStandings")
          .flatten()
          .value();

        scope.standingsData = {
          away: _.find(flatStandings, function (s) {
            return s.team.teamId === scope.boxScore.awayTeam.team.teamId;
          }),
          home: _.find(flatStandings, function (s) {
            return s.team.teamId === scope.boxScore.homeTeam.team.teamId;
          }),
          summary: standingsData.summary
        };
      }
    }
  }
})
;
