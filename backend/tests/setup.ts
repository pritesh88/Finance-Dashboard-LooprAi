// Runs before every test file, before any app module reads process.env.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'test-secret-test-secret-test-secret-1234';
process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017';
// Always a dedicated database so tests never touch real data.
process.env.MONGODB_DB = `${process.env.MONGODB_DB_TEST ?? 'finance_dashboard_test'}`;
