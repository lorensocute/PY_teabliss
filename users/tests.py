from rest_framework.test import APITestCase
from users.models import Address, User
class UserAuthProfileAddressTests(APITestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			email="customer@example.com",
			password="StrongPass123!",
			full_name="Tea Customer",
			phone="0900000000",
		)

	def test_register_creates_customer_with_hashed_password(self):
		response = self.client.post("/api/auth/register/", {
			"full_name": "New Customer",
			"email": "new@example.com",
			"phone": "0911111111",
			"password": "NewStrong123!",
			"role": "ADMIN",
		}, format="json")

		self.assertEqual(response.status_code, 201)
		created_user = User.objects.get(email="new@example.com")
		self.assertEqual(created_user.role, "CUSTOMER")
		self.assertTrue(created_user.check_password("NewStrong123!"))
		self.assertNotEqual(created_user.password, "NewStrong123!")
		self.assertNotIn("password", response.data)

	def test_register_rejects_password_shorter_than_eight_characters(self):
		response = self.client.post("/api/auth/register/", {
			"full_name": "New Customer",
			"email": "new@example.com",
			"phone": "0911111111",
			"password": "short",
		}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(User.objects.filter(email="new@example.com").exists())

	def test_superuser_receives_admin_role(self):
		admin_user = User.objects.create_superuser(
			email="admin@example.com",
			password="AdminStrong123!",
			full_name="Tea Admin",
		)
		self.assertEqual(admin_user.role, "ADMIN")
		self.assertTrue(admin_user.is_staff)
		self.assertTrue(admin_user.is_superuser)
		self.assertEqual(User.REQUIRED_FIELDS, ["full_name"])

	def test_login_email_token_authenticates_profile_request(self):
		login_response = self.client.post("/api/auth/login/", {
			"email": self.user.email,
			"password": "StrongPass123!",
		}, format="json")

		self.assertEqual(login_response.status_code, 200)
		self.assertIn("access", login_response.data)
		self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login_response.data['access']}")

		profile_response = self.client.get("/api/profile")

		self.assertEqual(profile_response.status_code, 200)
		self.assertEqual(profile_response.data["email"], self.user.email)

	def test_profile_update_cannot_change_email_or_role(self):
		self.client.force_authenticate(self.user)

		response = self.client.put("/api/profile", {
			"full_name": "Updated Customer",
			"phone": "0922222222",
			"email": "attacker@example.com",
			"role": "ADMIN",
		}, format="json")

		self.assertEqual(response.status_code, 200)
		self.user.refresh_from_db()
		self.assertEqual(self.user.full_name, "Updated Customer")
		self.assertEqual(self.user.phone, "0922222222")
		self.assertEqual(self.user.email, "customer@example.com")
		self.assertEqual(self.user.role, "CUSTOMER")

	def test_address_creation_belongs_to_authenticated_user(self):
		self.client.force_authenticate(self.user)
		response = self.client.post("/api/profile/addresses", {
			"recipient_name": "Tea Customer",
			"phone": "0900000000",
			"province": "Ha Noi",
			"district": "Cau Giay",
			"ward": "Dich Vong",
			"detail_address": "1 Tea Street",
			"is_default": True,
		}, format="json")

		self.assertEqual(response.status_code, 201)
		address = Address.objects.get(pk=response.data["id"])
		self.assertEqual(address.user, self.user)
		self.assertEqual(address.city, "Ha Noi")

	def test_user_cannot_read_another_users_address(self):
		other_user = User.objects.create_user(
			email="other@example.com",
			password="StrongPass123!",
			full_name="Other Customer",
		)
		address = Address.objects.create(
			user=other_user,
			receiver_name="Other Customer",
			phone="0911111111",
			city="Ha Noi",
			district="Ba Dinh",
			ward="Doi Can",
			address_detail="2 Tea Street",
		)
		self.client.force_authenticate(self.user)

		response = self.client.get(f"/api/profile/addresses/{address.pk}")

		self.assertEqual(response.status_code, 404)

	def test_profile_requires_authentication(self):
		response = self.client.get("/api/profile")

		self.assertEqual(response.status_code, 401)
