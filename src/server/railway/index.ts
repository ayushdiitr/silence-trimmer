/**
 * Railway API Client
 * 
 * Provides programmatic access to Railway's API for custom domain management.
 * 
 * @see https://station.railway.com/feedback/enabling-complete-custom-domain-registra-6470c78b
 * @see https://docs.railway.app/reference/public-api
 */


const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

interface RailwayCustomDomainCreateResponse {
  data: {
    customDomainCreate: {
      id: string;
      domain: string;
      status: {
        dnsRecords: Array<{
          requiredValue: string;
          status: string;
        }>;
      };
    };
  };
  errors?: Array<{
    message: string;
  }>;
}

interface RailwayCustomDomainDeleteResponse {
  data: {
    customDomainDelete: boolean;
  };
  errors?: Array<{
    message: string;
  }>;
}

/**
 * Create a custom domain in Railway and get the CNAME value
 * 
 * @param domain - The domain to add (e.g., "videos.acmecorp.com")
 * @returns The CNAME value to use in DNS configuration
 */
export async function createRailwayCustomDomain(domain: string): Promise<{
  success: boolean;
  cnameValue: string | null;
  domainId: string | null;
  error?: string;
}> {
  const railwayToken = process.env.RAILWAY_API_TOKEN;
  const railwayServiceId = process.env.RAILWAY_SERVICE_ID;

  if (!railwayToken) {
    console.warn("RAILWAY_API_TOKEN not configured - cannot auto-create custom domains");
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: "Railway API token not configured",
    };
  }

  if (!railwayServiceId) {
    console.warn("RAILWAY_SERVICE_ID not configured - cannot auto-create custom domains");
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: "Railway service ID not configured",
    };
  }

  const mutation = `
    mutation customDomainCreate($input: CustomDomainCreateInput!) {
      customDomainCreate(input: $input) {
        id
        domain
        status {
          dnsRecords {
            requiredValue
            status
          }
        }
      }
    }
  `;

  const variables = {
    input: {
      serviceId: railwayServiceId,
      domain: domain,
    },
  };

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Railway API returned ${response.status}`);
    }

    const result = await response.json() as RailwayCustomDomainCreateResponse;

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message).join(", ");
      console.error("Railway API error:", errorMessage);
      return {
        success: false,
        cnameValue: null,
        domainId: null,
        error: errorMessage,
      };
    }

    const customDomain = result.data.customDomainCreate;
    const cnameRecord = customDomain.status.dnsRecords.find(record => 
      record.requiredValue
    );

    if (!cnameRecord) {
      throw new Error("No CNAME record found in Railway response");
    }

    console.log(`✅ Custom domain created in Railway: ${domain} -> ${cnameRecord.requiredValue}`);

    return {
      success: true,
      cnameValue: cnameRecord.requiredValue,
      domainId: customDomain.id,
    };
  } catch (error) {
    console.error("Failed to create Railway custom domain:", error);
    return {
      success: false,
      cnameValue: null,
      domainId: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Delete a custom domain from Railway
 * 
 * @param domainId - The Railway domain ID
 * @returns Success status
 */
export async function deleteRailwayCustomDomain(domainId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const railwayToken = process.env.RAILWAY_API_TOKEN;

  if (!railwayToken) {
    return {
      success: false,
      error: "Railway API token not configured",
    };
  }

  const mutation = `
    mutation customDomainDelete($id: String!) {
      customDomainDelete(id: $id)
    }
  `;

  const variables = {
    id: domainId,
  };

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${railwayToken}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Railway API returned ${response.status}`);
    }

    const result = await response.json() as RailwayCustomDomainDeleteResponse;

    if (result.errors && result.errors.length > 0) {
      const errorMessage = result.errors.map(e => e.message).join(", ");
      return {
        success: false,
        error: errorMessage,
      };
    }

    console.log(`✅ Custom domain deleted from Railway: ${domainId}`);

    return {
      success: result.data.customDomainDelete,
    };
  } catch (error) {
    console.error("Failed to delete Railway custom domain:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if Railway API is configured
 */
export function isRailwayApiConfigured(): boolean {
  return !!(process.env.RAILWAY_API_TOKEN && process.env.RAILWAY_SERVICE_ID);
}

