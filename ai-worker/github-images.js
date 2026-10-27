// Public gallery images only. Credentials and repository selection stay server-side.
const REPOSITORY = 'teslamap/garanti-group';
export function githubImagesConfigured(env) {
  return typeof env.PROJECT_IMAGES_GITHUB_TOKEN === 'string' &&
    Boolean(env.PROJECT_IMAGES_GITHUB_TOKEN.trim());
}

export async function saveGithubImage(bytes, extension, env, fetcher = fetch) {
  if (!githubImagesConfigured(env)) throw Error('GITHUB_STORAGE_NOT_CONFIGURED');
  const path = `uploads/projects/${crypto.randomUUID()}.${extension}`;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  const response = await fetcher(`https://api.github.com/repos/${REPOSITORY}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${env.PROJECT_IMAGES_GITHUB_TOKEN.trim()}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Garanti-Group-Project-Images',
      'X-GitHub-Api-Version': '2026-03-10'
    },
    body: JSON.stringify({message: 'Add public project photo [skip ci]', branch: 'main', content: btoa(binary)}),
    signal: AbortSignal.timeout(20000),
    redirect: 'manual'
  });
  // Never relay upstream bodies, which may contain configuration details.
  if (response.status !== 201) {
    const code = [401,403].includes(response.status) ? 'GITHUB_STORAGE_ACCESS_DENIED' :
      response.status === 409 ? 'GITHUB_STORAGE_CONFLICT' : 'GITHUB_STORAGE_UPLOAD_FAILED';
    throw Error(code);
  }
  const data = await response.json();
  if (!/^[a-f0-9]{40}$/.test(data.commit?.sha) || data.content?.path !== path) {
    throw Error('GITHUB_STORAGE_UPLOAD_FAILED');
  }
  return {
    provider: 'github', path,
    // Pin to the commit so later code deployments cannot change this image.
    url: `https://raw.githubusercontent.com/${REPOSITORY}/${data.commit.sha}/${path}`
  };
}
