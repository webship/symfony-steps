<?php

// Added by the test app of the webship-js suite: the one page the demo does not have, an error
// nothing catches. A live app answers it with its 500 page; a development one with the debug page.
// The build script copies this file into src/Controller/: the route is /{_locale}/test-fixtures/server-error.

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class TestFixturesController extends AbstractController
{
    #[Route('/test-fixtures/server-error', name: 'test_fixtures_server_error', methods: ['GET'])]
    public function serverError(): Response
    {
        throw new \RuntimeException('The test app raised this error on purpose.');
    }
}
