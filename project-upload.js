
/**
 * GARANTI GROUP
 * Project image uploader
 *
 * GitHub public image storage
 * Supabase legacy URL support
 */

const GITHUB_OWNER = 'teslamap';
const GITHUB_REPO = 'garanti-group';

export function isProjectImageUrl(value) {
  try {
    if (typeof value !== 'string') return false;

    const url = new URL(value);

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return false;
    }

    // GitHub raw image URL
    if (url.hostname === 'raw.githubusercontent.com') {
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts.length !== 5 && parts.length !== 6) {
        return false;
      }

      if (
        parts[0] !== GITHUB_OWNER ||
        parts[1] !== GITHUB_REPO
      ) {
        return false;
      }

      const branch = parts[2];

      if (
        branch !== 'main' &&
        !/^[a-f0-9]{40}$/i.test(branch)
      ) {
        return false;
      }

      const filePath = parts.slice(3).join('/');

      return /^(?:uploads\/)?projects\/[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(
        filePath
      );
    }

    // Existing Supabase project images
    if (/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
      return /^\/storage\/v1\/object\/public\/project-images\/[A-Za-z0-9/_-]+\.(jpg|png|webp)$/i.test(
        url.pathname
      );
    }

    return false;
  } catch {
    return false;
  }
}

export async function uploadProjectPhoto(
  photo,
  user,
  endpoint,
  fetcher = fetch
) {
  if (!endpoint) {
    throw new Error(
      'პროექტის ფოტოების ატვირთვის Worker არ არის მითითებული.'
    );
  }

  const match =
    /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(
      photo
    );

  if (!match || photo.length > 2000100) {
    throw new Error(
      'ფოტო: JPG, PNG ან WebP, მაქსიმუმ 1.5 MB.'
    );
  }

  const bytes = Uint8Array.from(
    atob(match[2]),
    char => char.charCodeAt(0)
  );

  if (!bytes.length || bytes.length > 1500000) {
    throw new Error(
      'ფოტო: მაქსიმუმ 1.5 MB.'
    );
  }

  const extension = match[1] === 'jpeg'
    ? 'jpg'
    : match[1];

  const form = new FormData();

  form.append(
    'file',
    new Blob([bytes], {
      type: 'image/' + match[1]
    }),
    'project.' + extension
  );

  const token = await user.getIdToken(true);

  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token
    },
    body: form,
    signal: AbortSignal.timeout(30000),
    redirect: 'error'
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    if (data.error === 'AUTH_REQUIRED') {
      throw new Error(
        'Worker-მა ავტორიზაციის ტოკენი ვერ მიიღო.'
      );
    }

    if (data.error === 'INVALID_TOKEN') {
      throw new Error(
        'Worker-მა Firebase ტოკენი უარყო.'
      );
    }

    throw new Error(
      'ატვირთვის ავტორიზაცია უარყოფილია (HTTP 401).'
    );
  }

  if (response.status === 403) {
    throw new Error(
      'ადმინისტრატორის წვდომა უარყოფილია. გადაამოწმეთ admins/{uid}.active=true.'
    );
  }

  if (data.error === 'GITHUB_STORAGE_NOT_CONFIGURED') {
    throw new Error(
      'GitHub Storage არ არის კონფიგურირებული.'
    );
  }

  if (data.error === 'GITHUB_STORAGE_ACCESS_DENIED') {
    throw new Error(
      'GitHub-ზე ფოტოს ჩაწერის უფლება უარყოფილია.'
    );
  }

  if (data.error === 'GITHUB_STORAGE_CONFLICT') {
    throw new Error(
      'GitHub-ზე პარალელური ცვლილებაა. სცადეთ ხელახლა.'
    );
  }

  if (!response.ok) {
    throw new Error(
      data.message ||
      'პროექტის ფოტოს ატვირთვა ვერ დასრულდა.'
    );
  }

  if (!isProjectImageUrl(data.url)) {
    throw new Error(
      'Worker-მა პროექტის ფოტოს სწორი საჯარო URL არ დააბრუნა.'
    );
  }

  return data.url;
}
