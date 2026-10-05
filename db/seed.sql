-- Sample data. Demo login: demo@hourglass.test / Password123!
INSERT INTO businesses (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Hourglass Clinic');

INSERT INTO users (id, business_id, email, password_hash, name)
VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001',
        'demo@hourglass.test', '$2b$10$g3AT/dA49gIHpsP7q6pXneTOEhrbXAFxgNydJl7rtmqzelwDdkoQ6', 'Demo User');

INSERT INTO appointments (business_id, user_id, service, starts_at, ends_at, status, source, notes)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
        'Consultation', now() + interval '2 days', now() + interval '2 days 30 minutes',
        'confirmed', 'form', 'First visit');

INSERT INTO chat_sessions (business_id, user_id, messages, extracted_state)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1',
        '[{"role":"user","content":"I need a checkup next week","at":"2026-10-03T09:00:00Z"}]',
        '{"booking":{"service":"Checkup"},"misses":0}');
