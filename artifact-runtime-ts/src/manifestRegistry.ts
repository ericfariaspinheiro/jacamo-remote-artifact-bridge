import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import type { ArtifactManifestMessage } from "./protocol.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const manifestFilesByArtifact: Record<string, string> = {
  SentimentArtifact: "sentiment.manifest.json",
  TwitterArtifact: "twitter.manifest.json",
}

export function getManifestForArtifact(
  artifact: string
): ArtifactManifestMessage {
  const manifestFile = manifestFilesByArtifact[artifact]

  if (!manifestFile) {
    throw new Error(`Unknown artifact manifest: ${artifact}`)
  }

  const manifestPath = resolve(__dirname, "../contracts", manifestFile)
  const rawManifest = readFileSync(manifestPath, "utf-8")
  const manifest = JSON.parse(rawManifest) as ArtifactManifestMessage

  validateManifest(manifest, artifact)

  return manifest
}

function validateManifest(
  manifest: ArtifactManifestMessage,
  expectedArtifact: string
) {
  if (manifest.type !== "artifact_manifest") {
    throw new Error("Invalid manifest: type must be artifact_manifest")
  }

  if (manifest.artifact !== expectedArtifact) {
    throw new Error(
      `Invalid manifest: expected ${expectedArtifact}, received ${manifest.artifact}`
    )
  }

  if (!Array.isArray(manifest.operations)) {
    throw new Error("Invalid manifest: operations must be an array")
  }
}