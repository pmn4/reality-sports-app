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
      if (_.every(properties, function (p) { _.isEmpty($scope[p]); })) {
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
  $scope.showRightMenu = false; // @todo: make this work

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
    var errorMessage;

    if (response.status === 401) {
      $state.go("app.logout");
    } else {
      errorMessage = response.data || "Request failed";

      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join("\n");
      }

      $scope.info(errorMessage);
    }
  };

  $scope.info = function (message) {
    if (!window.plugins) {
      console.log("Toast not available", message);
      return;
    }

    $cordovaToast.show(message, "short", "bottom");
  };

  $scope.loggedIn = function (loggedIn) {
    $scope.loggedInState = loggedIn;
  };
  $scope.loggedIn(!!AuthTokenStore.token());

  if (!AppStateService.currentWeek()) {
    AppStateService.currentWeek(AppStateService.guessCurrentWeek());
  }
})

.controller("LoginController", function ($scope, $state, $timeout, $cordovaToast, $cordovaSplashscreen, AuthService, AppStateService) {
  // Form data for the login modal
  $scope.loginData = {
    username: AppStateService.currentEmail()
  };

  $timeout(function () { $cordovaSplashscreen.hide(); });

  $scope.attempts = 0;

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

        if (Array.isArray($scope.errorMessage)) {
          $scope.errorMessage = $scope.errorMessage.join("\n");
        }
        $cordovaToast.show(response.data || "Login Failed", "long", "bottom");
      })
      .finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        $scope.attempts++;
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
  };
})

.controller("LeaguesController", function ($scope, $interval, $state, $stateParams, $filter, $timeout, $cordovaSplashscreen, LeagueService, AppStateService) {
  $scope.leagues = [];

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    LeagueService.list(force)
      .then(function (response) {
        $scope.leagues = response.data;
        $scope.setLastUpdated(new Date());

        $timeout(function () { $cordovaSplashscreen.hide(); });

        if (!$scope.leagues || !$scope.leagues.length) {
          return $scope.retryOnRsoError({
            status: 404,
            data: 'No leagues found'
          });
        }
        if ($scope.leagues && $scope.leagues.length === 1) {
          return $scope.gotoLeague($scope.leagues[0]);
        }

        currentLeague = _.find($scope.leagues, function (league) {
          return String(league.leagueId) === AppStateService.currentLeagueId();
        });

        if (!currentLeague) { return; }

        $scope.gotoLeague(currentLeague);
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

    $state.go("app.league", { leagueId: league.leagueId });
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

.controller("LeagueController", function ($rootScope, $scope, $state, $stateParams, $interval, AppStateService, CacheService, LeagueService, ScoreboardService, StandingsService, TeamService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = AppStateService.currentWeek();

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);

    $scope.currentLeague = CacheService.getLeagueById($scope.leagueId);
    $scope.week = AppStateService.guessCurrentWeek();
    $scope.team = $scope.currentLeague.team;
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.initialize = function () {
    $scope.refresh();
  };

  $scope.refresh = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);

    $scope.refreshScoreboard().finally(function () {
      $scope.ajaxing = $scope.indicateAjaxing(false);

      // Stop the ion-refresher from spinning
      $scope.$broadcast('scroll.refreshComplete');
    });

    $scope.refreshBids();
    $scope.refreshNews();
    $scope.refreshStandings();
    $scope.refreshTransactions();
  };

  $scope.refreshScoreboard = function () {
    return ScoreboardService.fetch($scope.leagueId, $scope.week)
      .then(function (response) {
        var data = response.data || {};
        $scope.boxScores = data.boxScores || [];
        $scope.setLastUpdated(new Date());

        $scope.boxScore = _.find($scope.boxScores, function (boxScore) {
          return boxScore.awayTeam.team.teamId === $scope.team.teamId ||
            boxScore.homeTeam.team.teamId === $scope.team.teamId;
        });

      }, function (response) {
        $scope.retryOnRsoError(response);
      })
  };

  $scope.refreshBids = function () {
    $scope.fetchingBids = true;
    TeamService.listBids($scope.leagueId, $scope.team.teamId)
      .then(function (response) {
        $scope.bids = response.data || [];
      }, function (response) {
        $scope.bidsError = 'Error fetching bids';
      }).finally(function () {
        $scope.fetchingBids = false;
      });
  };

  $scope.refreshStandings = function () {
    $scope.fetchingStandings = true;

    StandingsService.fetch($scope.leagueId, $scope.week - 1)
      .then(function (response) {
        $scope.standings = response.data.divisionStandings;

        if (!$scope.standings) { return; }

        $scope.rankDivision = _.find($scope.standings, function (standing) {
          if (!standing) { return false; }

          $scope.teamStanding = _.find(standing.teamStandings, function (team) {
            if (!team || !team.team) { return false; }

            return team.team.teamId === $scope.team.teamId;
          });

          return !!$scope.teamStanding;
        });

        if (!$scope.teamStanding) { return; }

        $scope.rank = $scope.teamStanding.rank;
        $scope.divisionSize = $scope.rankDivision.teamStandings.length;

        $scope.leagueSize = 0;
        $scope.pointsRank = _.chain($scope.standings)
          .map("teamStandings")
          .flatten()
          .reduce(function (memo, standing) {
            $scope.leagueSize++;

            if (standing.points >= $scope.teamStanding.points) {
              return memo + 1;
            }

            return memo;
          }, 0)
          .value();
      }, function (response) {
        $scope.standingsError = "Error fetching standings";
      }).finally(function () {
        $scope.fetchingStandings = false;
      });
  };

  $scope.refreshTransactions = function () {
    $scope.fetchingTransactions = true;

    LeagueService.splitTransactions($scope.leagueId, $scope.week)
      .then(function (response) {
        $scope.transactions = response.data.all;
        $scope.newTransactions = response.data.unread;
      }, function (response) {
        $scope.newsError = "Error fetching transactions";
      }).finally(function () {
        $scope.fetchingTransactions = false;
      });
  };

  $scope.refreshNews = function () {
    $scope.fetchingNews = true;
    TeamService.splitNews($scope.leagueId, $scope.team.teamId)
      .then(function (response) {
        $scope.articles = response.data.all;
        $scope.newArticles = response.data.unread;
      }, function (response) {
        $scope.newsError = "Error fetching news";
      }).finally(function () {
        $scope.fetchingNews = false;
      });
  };

  $scope.goToScoreboard = function () {
    $state.go("app.scoreboards", {
      leagueId: $scope.leagueId,
      week: AppStateService.currentWeek()
    });
  };

  $scope.goToTeam = function () {
    $state.go("app.team", {
      leagueId: $scope.leagueId,
      teamId: $scope.teamId
    });
  };

  $scope.initialize();

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
  $scope.$on("$ionicView.beforeLeave", function () {
    $interval.cancel($scope._intervalUpdated);
  });
})

.controller("CurrentLeagueController", function ($rootScope, $scope, $state, AppStateService, CacheService) {
  $scope.$on("$ionicView.enter", function () {
    if (!$state.params.leagueId || $state.params.leagueId === "default") {
      $state.params.leagueId = AppStateService.currentLeagueId();
    } else {
      AppStateService.currentLeagueId($state.params.leagueId);
    }

    if (!$state.params.week || $state.params.week === "default") {
      $state.params.week = AppStateService.currentWeek();
    }

    if (!$state.params.teamId || $state.params.teamId === "default") {
      $state.params.teamId = AppStateService.getOwnedTeamIdForCurrentLeague();
    }

    var whereTo = $state.current.name.replace("-for-current-league", "");

    if ($state.params.leagueId) {
      $state.go(whereTo || "app.league", $state.params, { location: 'replace' });
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

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

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

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = Mixins.throttle($scope, function () {
    var week = Math.max(1, $scope.week - 1);

    $scope.ajaxing = $scope.indicateAjaxing(true);
    StandingsService.fetch($scope.leagueId, week)
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

.controller("GameController", function ($scope, $ionicPlatform, $state, $stateParams, $interval, $filter, $ionicActionSheet, _, AppSettings, AppStateService, GameService) {
  var fnEnterEventHandler, fnExitEventHandler;

  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;
  $scope.gameId = $stateParams.gameId || "";
  $scope.homeTeam = {};
  $scope.awayTeam = {};
  $scope.playerScoringData = {};

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

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
              playerId: playerData.player.playerId
            });
            break;
          case 1:
            $scope.launch("twitter://search?query=" + $filter("playerFullName")(playerData.player));
            break;
        }
        return true;
      }
    });
  };

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

.controller("TeamController", function ($scope, $state, $stateParams, $interval, $q, $filter, AppSettings, AppStateService, CacheService, TeamService, PlayersService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.initialize = function () {
    $scope.refresh();

    // if owner?
    $scope.refreshBids();
    $scope.refreshNews();
  };

  $scope.refresh = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    var myTeam = CacheService.getLeagueById($scope.leagueId).team || {};

    TeamService.fetchRoster($scope.leagueId, $scope.teamId)
      .then(function (response) {
        $scope.team = response.data || {};
        $scope.isTeamOwner = $scope.team.teamId == myTeam.teamId;

        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.$broadcast("refreshed");
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.refreshBids = function () {
    $scope.fetchingBids = true;
    TeamService.listBids($scope.leagueId, $scope.teamId)
      .then(function (response) {
        $scope.bids = response.data || [];
      }, function (response) {
        $scope.bidsError = 'Error fetching bids';
      }).finally(function () {
        $scope.fetchingBids = false;
      });
  };

  $scope.refreshNews = function () {
    $scope.fetchingNews = true;
    TeamService.news($scope.leagueId, $scope.teamId, false)
      .then(function (response) {
        $scope.articles = response.data;

        $scope.recentArticles =
          $filter("articlesWithinDays")($scope.articles, 1);
      }, function (response) {
        $scope.newsError = 'Error fetching news';
      }).finally(function () {
        $scope.fetchingNews = false;
      });
  };

  $scope.goToFreeAgents = function () {
    $state.go("app.players", {
      leagueId: $scope.leagueId,
      playerFilter: "available" // note: not PlayersService.playerFilterOptions.available (whose value is the label "Available")
    });
  };

  $scope.goToActiveRoster = function () {
    this.goToRoster("active");
  };

  $scope.goToBenchRoster = function () {
    this.goToRoster("bench");
  };

  $scope.goToRoster = function (roster) {
    $state.go("app.roster", {
      leagueId: $scope.leagueId,
      teamId: $scope.teamId,
      roster: roster
    });
  };

  $scope.goToTeamNews = function () {
    $state.go("app.team-news", {
      leagueId: $scope.leagueId,
      teamId: $scope.teamId
    });
  };

  // $scope.$watch("team", function (team) {
  //   $scope.editable = team &&
  //     team.teamId == AppStateService.getOwnedTeamIdForCurrentLeague() &&
  //     _.chain(team.startingPositions)
  //       .map(function (p) { return p.player; })
  //       .compact()
  //       .some(function (p) { return !p.isLocked; })
  //       .value();
  // })

  if ($scope.teamId && $scope.teamId !== "default") {
    $scope.initialize();
  }

  $scope.$on("$ionicView.enter", function () {
    var teamId;

    if ($scope.teamId && $scope.teamId !== "default") { return; }

    teamId = CacheService.getOwnedTeamIdForLeague($scope.leagueId);

    $state.go(teamId ? $state.current.name : "app.league", {
      leagueId: $scope.leagueId,
      teamId: teamId
    }, { location: 'replace' });
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
})

.controller("RosterController", function ($scope, $state, $stateParams, $interval, $ionicPopup, $q, $filter, AppSettings, AppStateService, CacheService, TeamService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);

    TeamService.fetchRoster($scope.leagueId, $scope.teamId)
      .then(function (response) {
        $scope.team = response.data || {};
        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.$broadcast("refreshed");
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  if ($scope.leagueId && $scope.teamId) {
    $scope.refresh();
  }

  $scope.$watch("team", function (team) {
    $scope.editable = team &&
      team.teamId === AppStateService.getOwnedTeamIdForCurrentLeague() &&
      team.editAllowed;
  });

  $scope.$on("$ionicView.enter", function () {
    var whereTo, teamId;

    if (!$stateParams.leagueId || $stateParams.leagueId === "default") {
      $scope.leagueId = AppStateService.currentLeagueId();
    }

    if ($stateParams.teamId && $stateParams.teamId !== "default") {
      return;
    }

    whereTo = $state.current.name.replace("-for-current-league", "");
    teamId = AppStateService.getOwnedTeamIdForCurrentLeague();

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
      .filter(function (player) {
        return _.includes(position.positionsAllowed, player.pos);
      })
      .reject(function (player) {
        return position.player &&
          player.playerId === position.player.playerId ||
          player.startingSlot ||
          player.lineupStatus === 3; // IR
      })
      .value();

    swapPlayer(position, players)
      .then(function (playerId) {
        $scope.ajaxing = $scope.indicateAjaxing(true);

        TeamService.insertPlayer($scope.leagueId, $scope.teamId, position, playerId)
          .then(function (response) {
            var removeListener = $scope.$on("refreshed", function () {
              $scope.ajaxing = $scope.indicateAjaxing(false);
              removeListener();
            });

            $scope.info("Lineup Set.  Refreshing...");
            $scope.refresh();
          }, function (response) {
            $scope.retryOnRsoError(response);
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
      title: position.player ? "Replacing " + $filter("playerDisplayName")(position.player) : "",
      subTitle: "Position: " + position.slotLabel,
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

.controller("PlayersController", function ($rootScope, $scope, $state, $stateParams, $interval, $ionicModal, _, AppStateService, PlayersService) {
  var filters;

  $scope.leagueId = $stateParams.leagueId;
  $scope.players = null;
  $scope.player = {};

  $scope.filtered = !PlayersService.isEmptyFilters();
  $scope.defaultFilters = PlayersService.defaultFilters;

  filters = _.pick.apply(_, [$stateParams].concat(_.keys(PlayersService.defaultFilters)));
  $scope.filters = _.defaults(filters, PlayersService.currentFilters());
  PlayersService.currentFilters($scope.filters);

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    PlayersService.list($scope.leagueId, $scope.filters)
      .then(function (response) {
        $scope.playerStatsData = response.data || [];

        $scope.setLastUpdated(new Date());

        PlayersService.currentFilters($scope.filters);
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.refresh();

  $rootScope.$on("rsoPlayerSearchFilters:apply", function (_idk, filters) {
    $scope.filtered = !PlayersService.isEmptyFilters(filters);

    // @todo: do we even need $scope.filters?
    $scope.filters = filters;
    $scope.refresh();
  });

  $scope.$on("$ionicView.enter", function () {
    $scope.showRightMenu = true;

    $scope.setLastUpdated();

    // if ($scope.ajaxing) { return; }

    // // this shouldn't often happen, but sometimes we re-load a view
    // // which failed to refresh the first time.
    // $scope.refresh();
  });

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);

  $scope.$on("$ionicView.beforeLeave", function () {
    $scope.showRightMenu = false;

    $interval.cancel($scope._intervalUpdated);
  });

  ////////////// end boilerplate stuff //////////////
  $scope.goToTeam = function (teamId) {
    $state.go("app.team", {
      leagueId: $scope.leagueId,
      teamId: teamId
    });
  };

  $scope.clearTxtSearch = function () {
    $scope.filters.txtSearch = PlayersService.defaultFilters.txtSearch;

    $scope.refresh();
  };

  $scope.clearPlayerFilter = function () {
    $scope.filters.playerFilter = PlayersService.defaultFilters.playerFilter;

    $scope.refresh();
  };

  $scope.clearPosFilter = function () {
    $scope.filters.posFilter = PlayersService.defaultFilters.posFilter;

    $scope.refresh();
  };

  $ionicModal.fromTemplateUrl("templates/modals/player.html", {
    scope: $scope,
    animation: 'slide-in-up'
  }).then(function (modal) {
    $scope.modal = modal;
  });

  $scope.showPlayerDetails = function (player) {
    return $state.go("app.player", {
      leagueId: $scope.leagueId,
      playerId: player.playerId
    });

    // angular.extend($scope.player, player);

    // $scope.modal.show();
  };

  $scope.closeModal = function () {
    $scope.player = {};

    $scope.modal.hide();
  };
  // Cleanup the modal when we're done with it!
  $scope.$on("$destroy", function () {
    $scope.modal.remove();
  });
})

.controller("PlayerModalController", function ($scope, PlayersService) {
  $scope.beginIndicateAjaxing = function () { $scope.indicateAjaxing(true); };
  $scope.endIndicateAjaxing = function () { $scope.indicateAjaxing(false); };
})

.controller("PlayerController", function ($scope, $state, $stateParams, $interval, $ionicHistory, _, AppStateService, PlayersService) {
  var filters = _.pick.apply(_, [$stateParams].concat(_.keys(PlayersService.defaultFilters)));

  $scope.playerId = $stateParams.playerId;
  $scope.player = {};

  if (!$stateParams.leagueId || $stateParams.leagueId === "default") {
    $scope.leagueId = AppStateService.currentLeagueId();
  } else {
    $scope.leagueId = $stateParams.leagueId;

    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  // this should happen on all entries
  function checkRequiredParams() {
    if ($scope.playerId) { return; }

    return $state.go("app.players", {
      leagueId: $scope.leagueId
    });
  }

  $scope.beginIndicateAjaxing = function () { $scope.indicateAjaxing(true); };
  $scope.endIndicateAjaxing = function () { $scope.indicateAjaxing(false); };
  // the rsoPlayerDetail directive does most of the hard work here

  $scope.goBack = function () {
    if ($ionicHistory.backView()) {
      return $ionicHistory.goBack();
    }

    $state.go("app.players", {
      leagueId: $scope.leagueId
    }, { location: "replace" });
  };

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);

  $scope.$on("$ionicView.enter", function () {
    $scope.setLastUpdated();

    checkRequiredParams();
  });
})

.controller("BidController", function ($scope, $state, $stateParams, $interval, $ionicHistory, $q, $ionicPopup, $filter, _, AppStateService, TeamService, PlayersService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;
  $scope.playerId = $stateParams.playerId;
  $scope.player = {};

  var increment = 500000;
  $scope.leagueSalaryCap = 155270000;
  $scope.bidMinimum = 500000;
  $scope.bidMaximum = $scope.leagueSalaryCap;
  $scope.formData = {
    addPlayerId: $scope.playerId,
    addPlayerBidAmount: $scope.bidMinimum,
    dropPlayerId: ""
  };

  $scope.$watch("formData.dropPlayerId", function (val) { console.log(val); });

  $scope.incrementBid = function () {
    $scope.formData.addPlayerBidAmount += increment;
  };

  $scope.decrementBid = function () {
    $scope.formData.addPlayerBidAmount = Math.max($scope.bidMinimum, $scope.formData.addPlayerBidAmount - increment);
  };

  if ($scope.leagueId) {
    AppStateService.currentLeagueId($scope.leagueId);
  }

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  function goToPlayers() {
    $state.go($scope.leagueId ? "app.players" : "app.players-for-current-league", {
      leagueId: $scope.leagueId
    });
  }

  if (!$scope.playerId) { return goToPlayers(); }

  $scope.goBack = function () {
    if ($ionicHistory.backView()) {
      return $ionicHistory.goBack();
    }

    $state.go("app.player", {
      leagueId: $scope.leagueId,
      playerId: $scope.playerId
    }, { location: "replace" });
  };





  $scope.confirm = function () {
    addDropPlayer()
      .then(function (formData) {
        $scope.ajaxing = $scope.indicateAjaxing(true);

        TeamService.createBid($scope.leagueId, $scope.teamId, $scope.formData)
          .then(function (response) {
            $scope.info("Success");

            $state.go("app.team", {
              leagueId: $scope.leagueId,
              teamId: $scope.teamId
            }, { location: "replace" });
          }, function (response) {
            $scope.retryOnRsoError(response);
          }).finally(function () {
            $scope.ajaxing = $scope.indicateAjaxing(false);
          });
      }, function (response) {
        if (!response) { return; /* cancel */ }
      });
  };

  function addDropPlayer() {
    var deferred = $q.defer(), addDropPopup;

    if ($scope.formData.dropPlayerId) {
      $scope.dropPlayer = _.find($scope.adjustableRoster.roster, function (player) {
        return player.playerId === $scope.formData.dropPlayerId;
      });
    }

    addDropPopup = $ionicPopup.show({
      template: '<p>'+
  'If successful, you will be <strong>adding {{ player | playerFullName }}</strong> for 1 year at {{ formData.addPlayerBidAmount | toDollars }}.' +
'</p>' +
'<p ng-if="formData.dropPlayerId">' +
  'In addition, you will be <strong>dropping {{ dropPlayer | playerFullName }}</strong>.' +
'</p>' +
'<p ng-if="formData.dropPlayerId" ng-show="dropPlayer.acceleratedAmtCurrYear > 0">' +
  'If {{ dropPlayer.lastName }} is unclaimed by another franchise, the following amounts will be charged against your salary cap:' +
'</p>' +
  '<div class="row" ng-if="dropPlayer.acceleratedAmtCurrYear > 0"><div class="col">This Year:</div><div class="col text-right">{{ dropPlayer.acceleratedAmtCurrYear | toDollars }}</div></div>' +
  '<div class="row" ng-if="dropPlayer.acceleratedAmtNextYear > 0"><div class="col">Next Year:</div><div class="col text-right">{{ dropPlayer.acceleratedAmtNextYear | toDollars }}</div></div>' +
'',
      title: $scope.player ? "Add " + $filter("playerFullName")($scope.player) : "",
      subTitle: $scope.dropPlayer ? "Drop: " + $filter("playerFullName")($scope.dropPlayer) : "",
      scope: $scope,
      buttons: [
        { text: 'Cancel' },
        {
          text: '<b>Confirm</b>',
          type: 'button-positive',
          onTap: function (e) {
            return true;
          }
        }
      ]
    });

    addDropPopup.then(function (response) {
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







  $scope.refresh = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    $scope.refreshing = true;
    TeamService.fetchAdjustableRoster($scope.leagueId, $scope.teamId)
      .then(function (response) {
        $scope.adjustableRoster = response.data || {};
        $scope.rosterByPosition = _.groupBy($scope.adjustableRoster.roster, "pos");

        $scope.setLastUpdated(new Date());

        $scope.error = null;
      }, function (response) {
        $scope.error = response.data;
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.refreshing = false;

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.refresh();
  PlayersService.read($scope.leagueId, $scope.playerId)
    .then(function (response) {
      $scope.playerData = response.data;

      $scope.player = $scope.playerData.player;
    });

  $scope._intervalUpdated = $interval(function () {
    $scope.setLastUpdated();
  }, 60000);
})

.controller("NewsController", function ($scope, moment, $interval, $state, $stateParams, LeagueService, AppStateService) {
  $scope.leagueId = $stateParams.leagueId;

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    LeagueService.splitNews($scope.leagueId)
      .then(function (response) {
        var articles = response.data || {};

        $scope.articles = articles.all;
        $scope.unreadArticles = articles.unread;
        $scope.readArticles = articles.read;

        if (articles.maxReadDate) {
          AppStateService.lastLeagueNewsDate(articles.maxReadDate);
        }

        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

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

.controller("TransactionsController", function ($scope, moment, $interval, $state, $stateParams, LeagueService, AppStateService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.week = $stateParams.week;

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    LeagueService.splitTransactions($scope.leagueId, $scope.week)
      .then(function (response) {
        var transactions = response.data || {};

        $scope.transactions = transactions.all;
        $scope.unreadTransactions = transactions.unread;
        $scope.readTransactions = transactions.read;

        if (transactions.maxReadDate) {
          AppStateService.lastLeagueTransactionsDate(transactions.maxReadDate);
        }

        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  $scope.setWeek = function (week) {
    $state.go("app.transactions", {
      leagueId: $scope.leagueId,
      week: week
    });
  };

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

// TODO: Move unread/read logic to service: TeamService.splitNews
.controller("TeamNewsController", function ($scope, $interval, $state, $stateParams, TeamService, AppStateService) {
  $scope.leagueId = $stateParams.leagueId;
  $scope.teamId = $stateParams.teamId;

  $scope.setLastUpdated = Mixins.setLastUpdated($scope);

  $scope.pageTitle = "Team News";

  $scope.refresh = function (force) {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    TeamService.splitNews($scope.leagueId, $scope.teamId)
      .then(function (response) {
        var articles = response.data || {};

        $scope.articles = articles.all;
        $scope.unreadArticles = articles.unread;
        $scope.readArticles = articles.read;

        if (articles.maxReadDate) {
          AppStateService.lastTeamNewsDate($scope.teamId,articles.maxReadDate);
        }

        $scope.setLastUpdated(new Date());
      }, function (response) {
        $scope.retryOnRsoError(response);
      }).finally(function () {
        $scope.ajaxing = $scope.indicateAjaxing(false);

        // Stop the ion-refresher from spinning
        $scope.$broadcast('scroll.refreshComplete');
     });
  };

  if ($scope.teamId && $scope.teamId !== "default") {
    $scope.refresh();
  }

  $scope.$on("$ionicView.enter", function () {
    var teamId;

    if ($scope.teamId && $scope.teamId !== "default") { return; }

    teamId = CacheService.getOwnedTeamIdForLeague($scope.leagueId);

    $state.go(teamId ? $state.current.name : "app.league", {
      leagueId: $scope.leagueId,
      teamId: teamId
    }, { location: 'replace' });
  });

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
  var DATE_STRING_RE = /^\w+ \d+ \d+:\d+( [AP]M)?$/i;
  return function (dateString, format) {
    if (!DATE_STRING_RE.test(dateString)) { return dateString; }

    return moment(dateString, "MMM D h:mm")
      .year(new Date().getFullYear())
      .format("ddd h:mm");
  };
})

.filter("articlesWithinDays", function (_, moment) {
  var dateFormat = "YYYY-MM-DDThh:mm:ss";
  var DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d+$/i;

  var today = moment();

  return function (articles, numberOfDays) {
    if (!articles || !articles.length) { return; }

    return _.chain(articles)
      .filter(function (article) {
        return DATE_STRING_RE.test(article.releaseDate);
      })
      .filter(function (article) {
        var diffDays =
          moment(article.releaseDate, dateFormat).diff(today, "days");

        return Math.abs(diffDays) <= numberOfDays;
      })
      .value();
  };
})

.filter("isToday", function (moment) {
  var dateFormat = "YYYY-MM-DDThh:mm:ss";
  var DATE_STRING_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d+$/i;

  var thisMorning = moment().startOf("day");

  return function (dateStr) {
    if (!DATE_STRING_RE.test(dateStr)) { return; }

    return moment(dateStr, dateFormat).isAfter(thisMorning);
  };
})

.filter("nflGameYetToStart", function () {
  var FUTURE_GAME_RE = /^\w+ \d+ \d+:\d+/i;
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

.filter("toDollars", function () {
  return function (figure) {
    if (figure == null) { return; }

    if (figure.toFixed) {
      figure = figure.toFixed(0);
    }

    return "$" + (figure + "").replace(/(\d)(?=(\d{3})+$)/g, "$1,");
  };
})

.filter("toMmDollars", function () {
  return function (figure) {
    if (figure == null) { return; }

    if (!figure.toFixed) {
      figure = 1 * figure;
    }

    whole = Math.floor(figure / 1000000);
    fraction = (figure / 1000000) - whole;
    if (fraction < 0.25) {
      fraction = ".0";
    } else {
      fraction = (fraction + "").replace("0.", ".");
    }

    return "$" + (whole + "").replace(/(\d)(?=(\d{3})+$)/g, "$1,") + fraction + "mm";
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

.filter("playerAge", function (moment) {
  return function (player) {
    var birthdate;

    if (!player || !player.birthdate) { return; }

    birthdate = moment(player.birthdate, "M/D/YYYY");

    if (!birthdate.isValid()) { return; }

    return moment().diff(birthdate, 'years');
  };
})

.filter("playerDisplayName", function (_) {
  var teamDefenseLabels = ["DF", "DST"];

  return function (player) {
    var str, position;

    if (!player) { return; }

    position = player.position || player.pos;
    if (_.includes(teamDefenseLabels, position)) {
      return player.firstName;
    }

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

    return ImageCache.teamLogo(team.teamId);
  };
})

.filter("teamLogoById", function (ImageCache) {
  return function (teamId) {
    if (!teamId) { return ""; }

    return ImageCache.teamLogo(teamId);
  };
})

.filter("boxScoreForTeam", function (_) {
  return function (boxScore, teamId) {
    if (!boxScore || !teamId) { return; }

    return boxScore.awayTeam.team.teamId === teamId ||
      boxScore.homeTeam.team.teamId === teamId;
  };
})

.filter("humanReadableDateSince", function (moment) {
  return function (dateString, format) {
    return moment(dateString, format).fromNow(true);
  };
})

.filter("transactionDescription", function () {
  // TODO: replace <br>
  var TRADED_PATTERN = /^Traded/g;
  var TRADE_REPLACEMENT = '<i class="icon ion-reply energized"></i> Traded';
  var RECEIVED_PATTERN = /^Received/g;
  var RECEIVE_REPLACEMENT = '<i class="icon ion-forward positive"></i> Received';
  var ADDED_PATTERN = /^(Added|Add Player)/g;
  var ADD_REPLACEMENT = '<i class="icon ion-plus balanced"></i> $1';
  var DROPPED_PATTERN = /^(Dropped|Drop Player)/g;
  var DROP_REPLACEMENT = '<i class="icon ion-minus assertive"></i> $1';

  var POOL_MOVEMENTS = /^(?:Remove Player from|Add Player to) Free Agent Pool[^<]*(?:<br>|$)/g;

  // "Add Player to Free Agent Pool Lacy, Eddie SEA  (RB)<br>Remove Player from Free Agent Pool Cobb, Randall GB   (WR)<br>Drop Player from Roster Lacy, Eddie SEA  (RB)<br>Add Player to Roster Cobb, Randall GB   (WR)"

  return function (transaction) {
    var descriptions;

    if (!transaction || !transaction.fullDescription) { return; }

    descriptions = _.chain(transaction.fullDescription.split("<br>"))
      .reject(function (description) {
        return !description || description.match(POOL_MOVEMENTS);
      })
      .map(function (description) {
        return description
          .replace(TRADED_PATTERN, TRADE_REPLACEMENT)
          .replace(RECEIVED_PATTERN, RECEIVE_REPLACEMENT)
          .replace(ADDED_PATTERN, ADD_REPLACEMENT)
          .replace(DROPPED_PATTERN, DROP_REPLACEMENT);
      })
      .value();

    return descriptions.join("<br>"); // TODO:
  };
})

.directive("toggleClass", function () {
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
  $scope.checking = false;
  $scope.downloading = false;
  $scope.extracting = false;

  $scope.doExtraction = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    $scope.extracting = true;

    // Extract the updates
    $ionicDeploy.extract()
      .then(function (response) {
        $ionicDeploy.load();

        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.extracting = false;

        console.log('Ionic Deploy: Extraction Success! ', response);
      }, function (error) {
        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.extracting = false;

        console.error('Ionic Deploy: Unable to extract update', error);
      }, function (progress) {
        // Do something with the zip extraction progress
        $scope.extractionPercentComplete = progress;
      });
  };

  $scope.doUpdate = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    $scope.downloading = true;

    $ionicDeploy.download()
      .then(function (response) {
        $scope.doExtraction();

        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.downloading = false;

        console.log('Ionic Deploy: Download Success!', response);
      }, function (error) {
        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.downloading = false;

        console.error('Ionic Deploy: Unable to download', error);
      }, function (progress) {
        // Do something with the download progress
        $scope.downloadPercentComplete = progress;
      });
  };

  $scope.doCheck = function () {
    $scope.ajaxing = $scope.indicateAjaxing(true);
    $scope.checking = true;

    $ionicDeploy.check()
      .then(function (response) {
        $scope.hasUpdate = response;

        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.checking = false;

        if (!$scope.hasUpdate) { return; }

        $scope.doUpdate();

        console.log('Ionic Deploy: Update Ready!', response);
      }, function (error) {
        // finally doesn't work??
        $scope.ajaxing = $scope.indicateAjaxing(false);
        $scope.checking = false;

        console.error('Ionic Deploy: Unable to check for updates', error);
      });
  };

  $scope.$on("$ionicView.enter", function () {
    $scope.doCheck();
  });
})

.directive("rsaArticle", function () {
  return {
    restrict: "E",

    scope: {
      article: "=",
      leagueId: "="
    },

    templateUrl: "templates/directives/article.html"
  };
})

.directive("rsaTransaction", function () {
  return {
    restrict: "E",

    scope: {
      transaction: "=",
      leagueId: "=",
      week: "="
    },

    templateUrl: "templates/directives/transaction.html"
  };
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
  };
})

.directive("rsoPlayerDetail", function (PlayersService, CacheService) {
  return {
    replace: true,

    restrict: "E",

    scope: {
      leagueId: "=",
      playerId: "=",
      player: "=", // if you want to seed some data
      onRequest: "&",
      onSuccess: "&",
      onError: "&",
      onComplete: "&"
    },

    templateUrl: "templates/directives/player-detail.html",

    link: function ($scope) {
      var league;

      $scope.$watch("leagueId", refresh);
      $scope.$watch("playerId", refresh);
      $scope.$watch("player", refresh);

      league = CacheService.getLeagueById($scope.leagueId);
      if (league && league.team) {
        $scope.teamId = league.team.teamId;
      }

      function refresh() {
        if ($scope.refreshing === true) { return; }

        if (!$scope.player) { $scope.player = {}; }

        if (!$scope.leagueId || !$scope.playerId) {
          return;
        }

        $scope.refreshing = true;
        $scope.onRequest();
        PlayersService.read($scope.leagueId, $scope.playerId)
          .then(function (response) {
            $scope.playerData = response.data;

            angular.extend($scope.player, $scope.playerData.player);

            $scope.onSuccess({ response: response });
          }, function (response) {
            $scope.onError({ response: response });
          })
          .finally(function () {
            $scope.refreshing = false;

            $scope.onComplete();
          });
      }

      refresh();
    }
  };
})

.directive("rsoMicroPlayerDetail", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      player: "="
    },

    templateUrl: "templates/directives/micro-player-detail.html"
  };
})

.directive("rsoPlayerCardHeader", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      player: "=",
      showName: "="
    },

    templateUrl: "templates/directives/player-card-header.html"
  };
})

.directive("rsoPlayerSearchResults", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      playerStatsData: "=",
      onPlayerClick: "&",
      onTeamClick: "&"
    },

    templateUrl: "templates/directives/player-search-results.html",

    link: function (scope, element, attrs) {
      element.addClass(attrs.className);
    }
  };
})

.directive("rsoPlayerSearchFilters", function ($rootScope, $ionicSideMenuDelegate, AppStateService, PlayersService) {
  return {
    replace: true,

    restrict: "E",

    templateUrl: "templates/directives/player-search-filters.html",

    link: function ($scope) {
      $scope.expanded = false;
      $scope.filters = PlayersService.currentFilters();
      $scope.playerFilterOptions = PlayersService.playerFilterOptions;

      function broadcast() {
        $rootScope.$broadcast("rsoPlayerSearchFilters:apply", $scope.filters);
      }

      $rootScope.$on(AppStateService.events.LEAGUE_CHANGE, function (_e, league) {
        $scope.positions = league.playerPositions || [];
        $scope.positions.unshift("ALL");
      });

      $scope.clearTxtSearch = function () {
        $scope.filters.txtSearch = PlayersService.defaultFilters.txtSearch;
      };

      $scope.reset = function () {
        $scope.filters = PlayersService.defaultFilters;

        broadcast();

        $ionicSideMenuDelegate.toggleRight(false);
      };

      $scope.submit = function () {
        broadcast();

        $ionicSideMenuDelegate.toggleRight(false);
      };
    }
  };
})

.directive("rsoTeamRoster", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      team: "=",
      className: "=",
      onAssignPosition: "&"
    },

    templateUrl: "templates/directives/team-roster.html",

    link: function (scope, element, attrs) {
      element.addClass(attrs.className);

      scope.assignPosition = function (position) {
        if (!scope.onAssignPosition) { return; }

        scope.onAssignPosition({ position: position });
      };
    }
  };
})

.directive("rsoTeamRosterBench", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      team: "=",
      className: "=",
      onAssignPlayer: "&"
    },

    templateUrl: "templates/directives/team-roster-bench.html",

    link: function (scope, element, attrs) {
      element.addClass(attrs.className);

      scope.assignPlayer = function (player) {
        if (!scope.onAssignPlayer) { return; }

        scope.onAssignPlayer({ player: player });
      };
    }
  };
})

.directive("rsoTeamRosterReserves", function () {
  return {
    replace: true,

    restrict: "E",

    scope: {
      team: "=",
      className: "=",
      onAssignPlayer: "&"
    },

    templateUrl: "templates/directives/team-roster-reserves.html",

    link: function (scope, element, attrs) {
      element.addClass(attrs.className);

      scope.assignPlayer = function (player) {
        if (!scope.onAssignPlayer) { return; }

        scope.onAssignPlayer({ player: player });
      };
    }
  };
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
          .map("teamStandings")
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
  };
})

.directive("wipWipWip", function () {
  return {
    restrict: "E",

    replace: true,

    templateUrl: "templates/directives/wip-wip-wip.html"
  };
})
;
