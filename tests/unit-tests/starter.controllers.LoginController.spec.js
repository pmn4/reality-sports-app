describe("starter.controllers.LoginController", function () {
	var email, password, errorMessage, loginData;

	email = "abc@123.com";
	password = "doesn't matter";
	errorMessage = "testing message";

	loginData = {
		username: email,
		password: password,
		optIn: true
	};

	beforeEach(module("starter"));

	beforeEach(inject(function ($controller, $q) {
		deferredLogin = $q.defer();

		// mock dinnerService
		this.AuthService = {
			login: jasmine.createSpy("login spy")
				.and.returnValue(deferredLogin.promise)
		};

		this.AppStateService = {
			currentEmail: jasmine.createSpy("currentEmail spy"),
			clearCurrentLeagueId: jasmine.createSpy("clearCurrentLeagueId spy")
		}

		this.$scope = jasmine.createSpyObj("$scope spy", [
			"loggedIn",
			"indicateAjaxing"
		]);

		this.$state = jasmine.createSpyObj("$state spy", [
			"go"
		]);

		this.$cordovaToast = jasmine.createSpyObj("$cordovaToast spy", [
			"show"
		]);

		// instantiate LoginController
		this.controller = $controller("LoginController", {
			"$scope": this.$scope,
			"$state": this.$state,
			"AuthService": this.AuthService,
			"AppStateService": this.AppStateService
		});
	}));

	beforeEach(function () {
		$scope.loginData = loginData;
	});

	describe("#login", function () {
		it ("UX: indicates ajaxing", function () {
			expect(this.$scope.indicateAjaxing)
				.toHaveBeenCalledWith(false);
		});

		it ("calls login on AuthService", function () {
			expect(this.AuthService.login)
				.toHaveBeenCalledWith(loginData);
		});

		describe("on successful response from server", function () {
			it ("caches current email", function () {
				expect(this.AppStateService.currentEmail)
					.toHaveBeenCalledWith(email);
			});

			it ("clears cached League Id", function () {
				expect(this.AppStateService.clearCurrentLeagueId)
					.toHaveBeenCalled();
			});

			it ("set global logged in state", function () {
				expect(this.$scope.loggedIn)
					.toHaveBeenCalledWith(true);
			});

			it ("redirects to Leagues screen", function () {
				expect(this.$state.go)
					.toHaveBeenCalledWith("app.leagues");
			});
		});

		describe("on failed response from server", function () {
			it ("set global logged in state", function () {
				expect(this.$scope.loggedIn)
					.toHaveBeenCalledWith(false);
			});

			it ("shows error message", function () {
				expect(this.$cordovaToast.show)
					.toHaveBeenCalledWith(errorMessage);
			});
		});

		describe("on all responses from server", function () {
			it ("UX: clears ajaxing indicator", function () {
				expect(this.$scope.indicateAjaxing)
					.toHaveBeenCalledWith(false);
			});
		})
	});
});