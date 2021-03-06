function feedSplitter(_, moment, fnLastReadDate, dateKey) {
	var dateFormat = "YYYY-MM-DDThh:mm:ss";
	return function (response) {
		var maxReadDate, maxReadDateStr, lastReadDate, lastReadDateStr;

		lastReadDateStr = fnLastReadDate();
		lastReadDate = moment.utc(lastReadDateStr, dateFormat);

		var items = response.data || [];
		var unreadItems = [];
		var readItems = [];

		_.each(items, function (item) {
			var itemDate = moment.utc(item[dateKey], dateFormat);
			if (itemDate.isAfter(lastReadDate)) {
				unreadItems.push(item);
			} else {
				readItems.push(item);
			}

			if (!maxReadDate || itemDate.isAfter(maxReadDate)) {
				maxReadDate = itemDate;
				maxReadDateStr = item[dateKey];
			}
		});

		return {
			data: {
				unread: unreadItems,
				read: readItems,
				all: items,
				lastReadDate: lastReadDateStr,
				maxReadDate: maxReadDateStr
			}
		};
	};
}


angular.module("starter.services", [])

.service("ImageCache", function (/* $localStorage, */ _) {
	var STORE_KEY_TEAM_LOGOS;

	STORE_KEY_TEAM_LOGOS = "realitySportsApp.ImageCache>logos";

	function logosFromBoxScores(boxScores) {
		var teamLogos;

		teamLogos = _.reduce(boxScores, function (logos, boxScore) {
			logos[boxScore.awayTeam.team.teamId] =
				boxScore.awayTeam.imageUrl;

			logos[boxScore.homeTeam.team.teamId] =
				boxScore.homeTeam.imageUrl;

			return logos;
		}, {});

		return logos(teamLogos);
	}

	function logos (l) {
		if (l) {
			localStorage.setItem(STORE_KEY_TEAM_LOGOS, JSON.stringify(l));
		}

		return JSON.parse(localStorage.getItem(STORE_KEY_TEAM_LOGOS) || "[]");
	}

	function teamLogo(team) {
		var teamLogos = logos();

		if (!team || !teamLogos) { return ""; }

		return teamLogos[team];
	}

	function clearLogos () {
		localStorage.setItem(STORE_KEY_TEAM_LOGOS, "");
	}

	return {
		logos: logos,
		clearLogos: clearLogos,
		logosFromBoxScores: logosFromBoxScores,
		teamLogo: teamLogo
	};
})

.service("LeagueService", function ($http, $q, _, AppSettings, AppStateService, CacheService, AuthTokenStore) {
	var previousSession;

	var TRANSACTION_TYPE_LINEUP_CHANGE = 'Lineup Changes';
	var TRANSACTION_TYPE_ACQUISITIONS = 'Acquisitions';
	var TRANSACTION_TYPE_ACQUISITIONS_REPLACEMENT = 'Add/Drop';

	return {
		list: list,
		news: news,
		splitNews: splitNews,
		transactions: transactions,
		splitTransactions: splitTransactions,
		Types: {
			LineupChange: TRANSACTION_TYPE_LINEUP_CHANGE
		}
	};

	function list(force) {
		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues"
			url: AppSettings.apiHost + "/v2/leagues"
		}).then(function (response) {
			if (!response || !response.data) { return; }

			CacheService.leagues(response.data);

			return response;
		});
	}

	function news(leagueId, filters) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/articles",
			params: filters
		});
	}

	function splitNews(leagueId, teamId) {
		return this.news(leagueId, teamId)
			.then(feedSplitter(_, moment, AppStateService.lastLeagueNewsDate, "releaseDate"));
	}

	function transactions(leagueId, week, filters, includeLineupChanges) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/weeks/" + week + "/transactions",
			params: filters
		}).then(function (response) {
			var data = response.data;

			_.chain(data)
				.filter(function (transaction) {
					return transaction.trxType === TRANSACTION_TYPE_ACQUISITIONS;
				})
				.each(function (transaction) {
					transaction.trxType = TRANSACTION_TYPE_ACQUISITIONS_REPLACEMENT;
				})
				.value();

			if (includeLineupChanges) { return response; }

			data = _.reject(data, function (transaction) {
				return transaction.trxType === TRANSACTION_TYPE_LINEUP_CHANGE;
			});

			return { data: data };
		});
	}

	function splitTransactions(leagueId, week, filters, includeLineupChanges) {
		return this.transactions(leagueId, week, filters, includeLineupChanges)
			.then(feedSplitter(_, moment, AppStateService.lastLeagueTransactionsDate, "trxDate"));
	}
})

.factory("AuthTokenStore", function (/* $localStorage */) {
	var STORE_KEY_TOKEN, STORE_KEY_SESSION;

	STORE_KEY_TOKEN = "realitySportsApp.AuthService>token";
	STORE_KEY_SESSION = "realitySportsApp.AuthService>session";

	function token (t) {
		if (t) {
			localStorage.setItem(STORE_KEY_TOKEN, t);
		}

		return localStorage.getItem(STORE_KEY_TOKEN);
	}

	function clearToken () {
		localStorage.setItem(STORE_KEY_TOKEN, "");
	}

	function session (s) {
		if (s) {
			localStorage.setItem(STORE_KEY_SESSION, s);
		}

		return localStorage.getItem(STORE_KEY_SESSION);
	}

	function clearSession () {
		localStorage.setItem(STORE_KEY_SESSION, "");
	}

	return {
		token: token,
		session: session,
		clearToken: clearToken,
		clearSession: clearSession
	};
})

.service("AuthService", function ($http, AppSettings, AuthTokenStore) {
	return {
		refreshSession: refreshSession,
		login: login
	};

	function refreshSession () {
		AuthTokenStore.clearSession();

		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/tokens"
		});
	}

	function login (data) {
		return $http({
			method: "POST",
			// url: AppSettings.apiHost + "/v1/tokens",
			url: AppSettings.apiHost + "/v2/tokens",
			data: data
		});
	}
})

.service("CacheService", function (/* $localStorage, */ _) {
	var STORE_KEY_LEAGUES;

	STORE_KEY_LEAGUES = "realitySportsApp.Cache>leagues";

	return {
		leagues: leagues,
		getLeagueById: getLeagueById,
		getOwnedTeamIdForLeague: getOwnedTeamIdForLeague
	};

	function leagues(leaguesData) {
		if (leaguesData) {
			localStorage.setItem(STORE_KEY_LEAGUES, JSON.stringify(leaguesData));
		}

		return JSON.parse(localStorage.getItem(STORE_KEY_LEAGUES) || "[]");
	}

	function getLeagueById(leagueId) {
		leagueId = parseInt(leagueId, 10);

		return _.find(leagues(), function (l) {
			return l.leagueId === leagueId;
		});
	}

	function getOwnedTeamIdForLeague(leagueId) {
		var league = this.getLeagueById(leagueId);

		return _.get(league, "team.teamId");
	}
})

.service("AppStateService", function ($rootScope, moment, CacheService) {
	var STORE_KEY_CURRENT_LEAGUE, STORE_KEY_LEAGUES, STORE_KEY_CURRENT_WEEK, STORE_KEY_CURRENT_EMAIL;

	STORE_KEY_CURRENT_LEAGUE = "realitySportsApp.AppState>currentLeagueId";
	STORE_KEY_LEAGUES = "realitySportsApp.AppState>leagues";
	STORE_KEY_CURRENT_WEEK = "realitySportsApp.AppState>currentWeek";
	STORE_KEY_CURRENT_EMAIL = "realitySportsApp.AppState>currentEmail";
	STORE_KEY_CURRENT_PLAYER_FILTERS = "realitySportsApp.AppState>currentPlayerFilters";
	STORE_KEY_LAST_LEAGUE_NEWS_DATE = "realitySportsApp.AppState>lastLeagueNewsDate";
	STORE_KEY_LAST_LEAGUE_TRANSACTIONS_DATE = "realitySportsApp.AppState>lastLeagueTransactionsDate";
	STORE_KEY_LAST_TEAM_NEWS_DATE = "realitySportsApp.AppState>lastTeamNewsDate";

	var OPENING_NIGHT = moment("2017-09-08");
	var WEEK = 7 * 24 * 60 * 60 * 1000;
	var START_OF_TODAY = moment().startOf("day");

	return {
		currentLeagueId: currentLeagueId,
		currentPlayerFilters: currentPlayerFilters,
		clearCurrentLeagueId: clearCurrentLeagueId,
		clearCurrentPlayerFilters: clearCurrentPlayerFilters,
		currentWeek: currentWeek,
		currentEmail: currentEmail,
		guessCurrentWeek: guessCurrentWeek,
		lastLeagueNewsDate: lastLeagueNewsDate,
		lastLeagueTransactionsDate: lastLeagueTransactionsDate,
		lastTeamNewsDate: lastTeamNewsDate,
		getOwnedTeamIdForCurrentLeague: getOwnedTeamIdForCurrentLeague,
		events: {
			LEAGUE_ID_CHANGE: "AppStateService.leagueId:change",
			LEAGUE_CHANGE: "AppStateService.league:change",
			FILTERS_CHANGE: "AppStateService.filters:change",
			WEEK_CHANGE: "AppStateService.weekNum:change"
		}
	};

	function currentLeagueId(leagueId) {
		if (leagueId && leagueId !== "default") {
			localStorage.setItem(STORE_KEY_CURRENT_LEAGUE, leagueId);

			$rootScope.$broadcast(this.events.LEAGUE_ID_CHANGE, leagueId);
			$rootScope.$broadcast(
				this.events.LEAGUE_CHANGE,
				CacheService.getLeagueById(leagueId)
			);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_LEAGUE);
	}

	function clearCurrentLeagueId() {
		localStorage.setItem(STORE_KEY_CURRENT_LEAGUE, "");

		$rootScope.$broadcast(this.events.LEAGUE_ID_CHANGE, "");
	}

	function currentPlayerFilters(filters) {
		if (filters) {
			localStorage.setItem(STORE_KEY_CURRENT_PLAYER_FILTERS, JSON.stringify(filters));

			$rootScope.$broadcast(this.events.FILTERS_CHANGE, filters);
		}

		try {
			return JSON.parse(localStorage.getItem(STORE_KEY_CURRENT_PLAYER_FILTERS));
		} catch(e) {
			return null;
		}
	}

	function clearCurrentPlayerFilters() {
		localStorage.setItem(STORE_KEY_CURRENT_PLAYER_FILTERS, "");

		$rootScope.$broadcast(this.events.FILTERS_CHANGE, {});
	}

	function currentWeek(weekNum) {
		if (weekNum && weekNum !== "default") {
			localStorage.setItem(STORE_KEY_CURRENT_WEEK, weekNum);

			$rootScope.$broadcast(this.events.WEEK_CHANGE, weekNum);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_WEEK);
	}

	function guessCurrentWeek () {
		var week, league = CacheService.getLeagueById(this.currentLeagueId());

		if (league && league.weeks && league.weeks.length) {
			week = (league.weeks[league.weeks.length - 1] || {}).weekNum;
		}

		if (!week) {
			week = Math.floor(OPENING_NIGHT.diff(moment()) / (-1 * WEEK)) + 1;
		}

		return week;
	}

	function currentEmail(email) {
		if (email) {
			localStorage.setItem(STORE_KEY_CURRENT_EMAIL, email);

			$rootScope.$broadcast(this.events.WEEK_CHANGE, email);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_EMAIL);
	}

	function lastLeagueNewsDate(date) {
		var key = STORE_KEY_LAST_LEAGUE_NEWS_DATE;

		if (date) {
			localStorage.setItem(key, date);
		}

		return localStorage.getItem(key) || START_OF_TODAY;
	}

	function lastLeagueTransactionsDate(date) {
		var key = STORE_KEY_LAST_LEAGUE_TRANSACTIONS_DATE;

		if (date) {
			localStorage.setItem(key, date);
		}

		return localStorage.getItem(key) || START_OF_TODAY;
	}

	function lastTeamNewsDate(teamId, date) {
		var key = STORE_KEY_LAST_TEAM_NEWS_DATE + "-" + teamId;

		if (date) {
			localStorage.setItem(key, date);
		}

		return localStorage.getItem(key) || START_OF_TODAY;
	}

	function getOwnedTeamIdForCurrentLeague() {
	    var leagueId = this.currentLeagueId();

	    return CacheService.getOwnedTeamIdForLeague(leagueId);
	}
})

.service("ScoreboardService", function ($http, AppSettings, AppStateService) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week, gameId) {
		if (!week) {
			week = AppStateService.currentWeek() || "";
		}

		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/scoreboards"
		});
	}
})

.service("StandingsService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week) {
		return $http({
			method: "GET",
			cache: true,
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/standings"
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/standings"
		});
	}
})

.service("PlayersService", function ($http, AppSettings, $q, _, AppStateService) {
	return {
		list: list,
		read: read,
		defaultFilters: {
			playerFilter: "all",
			posFilter: "ALL",
			txtSearch: ""
		},
		playerFilterOptions: {
			all: "All",
			// myroster: "My Roster",
			available: "Available"
		},
		currentFilters: currentFilters,
		isEmptyFilters: isEmptyFilters
	};

	function list(leagueId, filters) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/players",
			params: filters
		});
	}

	function read(leagueId, playerId) {
		return $http({
			method: "GET",
			cache: true,
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/players/" + playerId
		});
	}

	function currentFilters(filters) {
		return AppStateService.currentPlayerFilters(filters) || this.defaultFilters;
	}

	// test whether the filters that you pass, or the currentFilters, equal the default
	function isEmptyFilters(filters) {
		if (!filters) {
			if (arguments.length > 0) { return true; }

			filters = currentFilters();
		}

		return _.isEqual(filters, this.defaultFilters);
	}
})

.service("PlayerPositionsService", function ($http, AppSettings, $q, AppStateService) {
	return {
		list: list
	};

	function list(leagueId) {
		if (!leagueId) {
			leagueId = AppStateService.currentLeagueId();
		}

		return $http({
			method: "GET",
			cache: true,
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/player_positions"
		});
	}
})

.service("TeamService", function ($http, _, moment, AppSettings, AppStateService) {
	return {
		news: news,
		splitNews: splitNews,

		fetchRoster: fetchRoster,
		fetchAdjustableRoster: fetchAdjustableRoster,
		insertPlayer: insertPlayer,

		listBids: listBids,
		createBid: createBid,
		updateBid: updateBid,
		destroyBid: destroyBid
	};

	function news(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/articles"
		});
	}

	function splitNews(leagueId, teamId) {
		var fnLastReadDate = _.partial(AppStateService.lastTeamNewsDate, teamId);

		return this.news(leagueId, teamId)
			.then(feedSplitter(_, moment, fnLastReadDate, "releaseDate"));
	}

	function fetchRoster(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/rostered_players"
		})
		.then(function (response) {
			var data, slotted = [];

			data = response.data;
			data.leagueId = leagueId;

			_.each(data.lineupPlayers, function (player) {
				player.projectedPoints = player.projPoints;
				player.game = {
					opponent: player.opponent,
					// timeRemaining:,
					team: player.nflTeam,
					gameStatus: player.gameStatus/*,
					teamScore:,
					opponentScore:*/
				};
			});

			_.each(data.startingPositions, function (position) {
				if (!position.positionsAllowed || !position.positionsAllowed.length) {
					position.positionsAllowed = [position.slotLabel];
				}

				position.player = _.find(data.lineupPlayers, function (player) {
					return (player.startingSlot || player.pos) === position.startingSlot &&
						player.lineupStatus === 1 &&
						!_.includes(slotted, player.playerId);
				});

				if (!position.player) { return; }

				slotted.push(position.player.playerId);
			});

			data.bench = _.filter(data.lineupPlayers, function (player) {
				return player.lineupStatus === 2;
			});

			data.reserves = _.filter(data.lineupPlayers, function (player) {
				return player.lineupStatus === 3;
			});

			return { data: data };
		});
	}

	function fetchAdjustableRoster(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/adjustable_players"
		});
	}

	function insertPlayer(leagueId, teamId, position, playerId) {
		var data = [{
			playerId: playerId,
			lineupStatus: position.lineupStatus || 1,
			startingSlot: position.startingSlot
		}];

		if (position.player) {
			data.push({
				playerId: position.player.playerId,
				lineupStatus: 2
			});
		}
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/rostered_players",
			data: { changedPlayers: data }
		});
	}

	function listBids(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids"
		});
	}

	function createBid(leagueId, teamId, formData) {
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids",
			data: { bid: formData }
		});
	}

	function updateBid(leagueId, teamId, acquisitionId, formData) {
		return $http({
			method: "PUT",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids/" + bidId,
			data: { bid: formData }
		});
	}

	function destroyBid(leagueId, teamId, acquisitionId) {
		return $http({
			method: "DELETE",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids/" + bidId
		});
	}
})

.service("GameService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week, gameId) {
		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week + "/game_summaries/" + gameId
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/game_summaries/" + gameId
		});
	}
})

.service("HelpService", function ($http, AppSettings) {
	return {
		submitFeedback: submitFeedback
	};

	function submitFeedback (data) {
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v1/feedback",
			data: data
		});
	}
})

;