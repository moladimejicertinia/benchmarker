ALTER TABLE performance.ui_test_result
  ADD COLUMN lws_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE performance.ui_alert
  ADD COLUMN lws_enabled BOOLEAN NOT NULL DEFAULT FALSE;
