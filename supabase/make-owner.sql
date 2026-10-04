-- Makes one email the owner of the site. Replace the email below (twice), then press Run.
-- The owner can then sign in with Google using that email, or with a password if you created
-- the user in Supabase > Authentication > Users.

insert into public.admin_emails (email) values ('PUT-YOUR-EMAIL-HERE')
on conflict (email) do nothing;

insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('PUT-YOUR-EMAIL-HERE')
on conflict (user_id) do nothing;

-- This should show your email:
select email from public.admin_emails;
